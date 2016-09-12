const request = require('request');

/**
 * proxy main method
 * @param  {HttpRequest}    req
 * @param  {Object}         options
 * the request options but not use callback
 * @param  {Function}       options.modifyResponseBody
 * a function has a chance to change response headers and body before pipe to dest
 * @param  {HttpResponse}   res
 * @return {Promise}  fullfiled with proxy request object
 */
function proxy(req, options, res) {
  if (!req.readable) throw new Error('Can not proxy readed request');

  let modifyResponseBody;
  if (options && 'modifyResponseBody' in options) {
    if (typeof options.modifyResponseBody !== 'function') {
      throw new Error('options.modifyResponseBody must be function');
    }
    modifyResponseBody = options.modifyResponseBody;
    // tigger body parse
    options.callback = () => {};
  }

  const proxyReq = request(options);
  req.pipe(proxyReq);

  return new Promise((resolve, reject) => {
    proxyReq.on('error', reject);

    function _resovle(_request) {
      resolve(_request);
      if (res) _request.pipe(res);
    }

    if (modifyResponseBody) {
      // proxyReq.emit('end') will cause proxyReq.emit('complete') so just listen once
      proxyReq.once('complete', (response, body) => {
        console.log('complete', response.statusCode, body)

        // can not run in setTimeout callback,
        // thus the change of response like headers will before pipe
        const newBody = modifyResponseBody.call(proxyReq, body);

        // it's the trick for request library,
        // then can use request.pipe(res) after response finished
        proxyReq._destdata = false;
        proxyReq._ended = false;
        proxyReq.gzip = true;

        _resovle(proxyReq);
        // do not use process.nextTick,
        // it will not let below code run after promise stream
        setTimeout(() => {
          proxyReq.emit('data', newBody);
          proxyReq.emit('end', '');
        }, 0);
      });
    } else {
      _resovle(proxyReq);
    }
  });
}

module.exports = proxy;
