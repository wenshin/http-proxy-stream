const debug = require('util').debuglog('proxy-request');
const request = require('request');

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
  return new Promise((resolve, reject) => {
    if (!req.readable) reject(new Error('proxy-request: Can not proxy readed request'));

    let modifyResponse;
    if (options && 'modifyResponse' in options) {
      if (typeof options.modifyResponse !== 'function') {
        reject(new Error('proxy-request: options.modifyResponse must be function'));
      }
      modifyResponse = options.modifyResponse;
      // tigger body parse
      options.callback = () => {};
      options.encoding = options.encoding || 'utf8';
      options.gzip = true;
    }


    const proxyReq = request(options);
    req.pipe(proxyReq);

    proxyReq.on('error', reject);

    if (modifyResponse) {
      debug('modifyResponse mode');

      // proxyReq.emit('end') will cause proxyReq.emit('complete') so just listen once
      proxyReq.once('complete', (response, body) => {
        debug('complete: src body: %s, headers: %o', body.slice(0, 100), response.headers);
        // request parse JSON has a bug
        if (response.headers['content-type'].indexOf('json') > -1 && typeof body === 'string') {
          try {
            response.body = JSON.parse(body);
          } catch (e) {
            debug('complete: parse json. \n%s\n%o', body, e);
          }
        }

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
        setTimeout(() => {
          debug('complete: new body: %o, headers: %o', response.body, response.headers);

          proxyReq.emit('response', response);
          if (res) proxyReq.pipe(res);
          proxyReq.emit('data', response.body);
          // use chunked
          proxyReq.emit('end', '0\r\n\r\n');
        }, 0);
      });
    } else {
      resolve(proxyReq);
      if (res) proxyReq.pipe(res);
    }
  });
}

module.exports = proxy;
