'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var debug = require('util').debuglog('proxy-request');
var request = require('request');
var mime = require('./mime');
var ProxyRequestError = require('./error');

/**
 * proxy main method
 * @param  {HttpRequest}    req
 * @param  {Object}         options
 * the request options but not use callback
 * @param  {Function}       options.modifyResponse
 * a function has a chance to change response headers and body before pipe to dest
 * @param  {HttpResponse}   res
 * @return {Promise}  fullfiled with proxy request object
 */
function proxy(req, options, res) {
  return new Promise(function (resolve, reject) {
    if (!req.readable) reject(new Error('proxy-request: Can not proxy readed request'));

    var modifyResponse = void 0;
    if (options && 'modifyResponse' in options) {
      if (typeof options.modifyResponse !== 'function') {
        reject(new Error('proxy-request: options.modifyResponse must be function'));
      }
      modifyResponse = options.modifyResponse;
      // tigger receiving response body
      options.callback = function () {};
      // "null" means do not change buffer to string
      options.encoding = options.encoding || null;
      // extract gzip content
      options.gzip = true;
    }

    var proxyReq = request(options);
    req.pipe(proxyReq).on('error', reject);

    if (modifyResponse) {
      debug('modifyResponse mode');

      // proxyReq.emit('end') will cause proxyReq.emit('complete') so just listen once
      proxyReq.once('complete', function (response, body) {
        debug('complete: src body: %s, headers: %o', body.slice(0, 100), response.headers);
        try {
          handleComplete(proxyReq, response, body, modifyResponse, res, resolve);
        } catch (err) {
          reject(new ProxyRequestError('complete event exception', err));
        }
      });
    } else {
      resolve(proxyReq);
      if (res) proxyReq.pipe(res);
    }
  });
}

module.exports = proxy;

function handleComplete(proxyReq, response, body, modifyResponse, res, resolve, reject) {
  // Only text/plain, text/html, application/json can stringify with 'utf8'.
  // other mime types if deal with `Buffer.from(bf.toString())`
  // can not return the same buffer as bf.
  if (body instanceof Buffer && mime.isUTF8(response.headers)) {
    body = body.toString();
  }
  // request parse JSON has a bug
  if (mime.isJSON(response.headers) && typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      debug('complete: parse json. \n%s\n%o', body, e);
    }
  }

  response.body = body;
  // can not run in setTimeout callback,
  // thus the change of response like headers will before pipe
  modifyResponse.call(proxyReq, response);

  // change to chunked encoding
  delete response.headers['content-length'];
  delete response.headers['content-encoding'];

  // it's the trick for request library,
  // then can use request.pipe(res) after response finished
  proxyReq._destdata = false;
  proxyReq._ended = false;
  proxyReq.gzip = true;

  resolve(proxyReq);
  // run after promise stream.
  // do not use process.nextTick,
  // it will not let below code run after promise stream
  setTimeout(function () {
    debug('complete: new body: %o, headers: %o', response.body, response.headers);
    afterPromise(proxyReq, response, res, reject);
  }, 0);
}

function afterPromise(proxyReq, response, res, reject) {
  proxyReq.emit('response', response);

  function tiggerPipe() {
    try {
      if (!response.body) return proxyReq.emit('end', '');

      var needJSONStringify = mime.isJSON(response.headers) && _typeof(response.body) === 'object' && !(response.body instanceof Buffer);
      proxyReq.emit('data', needJSONStringify ? JSON.stringify(response.body) : response.body);
      // use chunked
      proxyReq.emit('end', '0\r\n\r\n');
    } catch (err) {
      reject(new ProxyRequestError('triggerPipe error', err));
    }
  }

  if (res) {
    proxyReq.pipe(res);
    tiggerPipe();
  } else {
    // after response event finish then trigger pipe
    setTimeout(tiggerPipe, 0);
  }
}