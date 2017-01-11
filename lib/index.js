const debug = require('util').debuglog('proxy-request');
const stream = require('stream');
const request = require('request');
const mime = require('./mime');
const ProxyRequestError = require('./error');

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
  if (!req.readable) return Promise.reject(new ProxyRequestError('can not proxy readed request'));

  let modifyResponse;
  let onResponse = options.onResponse;
  if (options && 'modifyResponse' in options) {
    if (typeof options.modifyResponse !== 'function') {
      return Promise.reject(new ProxyRequestError('options.modifyResponse must be function'));
    }
    modifyResponse = options.modifyResponse;
    // tigger receiving response body
    options.callback = () => {};
    // "null" means do not change buffer to string
    options.encoding = options.encoding || null;
    // extract gzip content
    options.gzip = true;
  }

  const proxyReq = request(options);

  const promise = new Promise((resolve, reject) => {
    function _resolve(stream) {
      if (res) stream.pipe(res);
      resolve(stream);
    }

    req.pipe(proxyReq)
      .on('error', err => reject(new ProxyRequestError('request Request trigger error event', err)));

    if (onResponse || modifyResponse) {
      if (onResponse) {
        proxyReq.once('response', (resp) => {
          try {
            onResponse && onResponse(resp);
          } catch (err) {
            reject(new ProxyRequestError('options.onResponse throw error', err))
          }
          if (!modifyResponse) _resolve(proxyReq);
        });
      }

      if (modifyResponse) {
        // proxyReq.emit('end') will cause proxyReq.emit('complete') so just listen once
        proxyReq.once('complete', (response, body) => {
          debug('complete: src body: %s, headers: %o', body.slice(0, 100), response.headers);
          response.body = body;
          try {
            const stream = createStream(proxyReq, response, modifyResponse);
            _resolve(stream);
          } catch (err) {
            reject(new ProxyRequestError('create new stream error', err));
          }
        });
      }
    } else {
      _resolve(proxyReq);
    }
  });
  return promise;
}

proxy.ProxyRequestError = ProxyRequestError;

module.exports = proxy;

function createStream(proxyReq, response, modifyResponse) {
  let body = response.body;
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
    } catch (err) {
      throw new ProxyRequestError('parse body to json fail', err);
    }
  }

  response.body = body;

  // can not run in setTimeout callback,
  // thus the change of response like headers will before pipe
  try {
    modifyResponse.call(proxyReq, response);
  } catch (err) {
    throw new ProxyRequestError('options.modifyResponse throw error', err)
  }
  return createResponseStream(response);
}


function createResponseStream(response) {
  let readedLength = 0;
  let data = response.body || '';

  const needJSONStringify = mime.isJSON(response.headers)
    && typeof data === 'object'
    && !(data instanceof Buffer);
  data = needJSONStringify ? JSON.stringify(data) : data;

  const readable = new stream.Readable({
    read(size) {
      if (!data || readedLength >= data.length) {
        return this.push(null);
      }

      const chunk = data.slice(readedLength, readedLength + size);
      readedLength += chunk.length;
      this.push(Buffer.from(chunk));
    }
  });

  const oldPipe = readable.pipe;
  readable.pipe = function pipe(dest) {
    pipeHttpMeta(response, dest);
    oldPipe.call(readable, dest);
  }
  return readable;
}

/**
 * Copy from request library. https://github.com/request/request
 */
function pipeHttpMeta(src, dest) {
  const response = src

  // use http default encoding
  delete response.headers['content-length'];
  delete response.headers['content-encoding'];
  delete response.headers['transfer-encoding'];

  // Called after the response is received
  if (dest.headers && !dest.headersSent) {
    if (response.caseless.has('content-type')) {
      const ctname = response.caseless.has('content-type')
      if (dest.setHeader) {
        dest.setHeader(ctname, response.headers[ctname])
      }
      else {
        dest.headers[ctname] = response.headers[ctname]
      }
    }
  }
  if (dest.setHeader && !dest.headersSent) {
    for (let i in response.headers) {
      // If the response content is being decoded, the Content-Encoding header
      // of the response doesn't represent the piped content, so don't pass it.
      if (!src.gzip || i !== 'content-encoding') {
        dest.setHeader(i, response.headers[i]);
      }
    }
  }
  dest.statusCode = response.statusCode;
  dest.statusMessage = response.statusMessage;
}
