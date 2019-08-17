const debug = require('util').debuglog('proxy-request');
const url = require('url');
const getOptions = require('./get-options');
const mime = require('./mime');
const ProxyRequestError = require('./error');
const CacheStream = require('./cache-stream');
const retrieveResponseStream = require('./retrieve-response-stream');
const rc = require('./read-content');
const pr = require('./post-response');
const setReqTimeout = require('./timeout');
const { getHttpRequest, isRedirecting, isSameOriginRedirect, isCache, } = require('./util');

module.exports = proxy;
proxy.CacheStream = CacheStream;
proxy.ProxyRequestError = ProxyRequestError;
proxy.retrieveResponseStream = retrieveResponseStream;
proxy.mime = mime;
proxy.readContent = rc;

/**
 * proxy main method
 * @param  {HttpRequest}    req
 * @param  {Object}         options
 * the request options but not use callback
 * @param  {Function}       options.modifyResponse
 * a function has a chance to change response headers and body before pipe to dest
 * @param  {Function}       options.skipModifyResponse
 * if return true will skip modifyResponse method
 * @param  {Function}       options.onResponse
 * a handler called once for 'response' event
 * @param  {Boolean|Function}        options.cache
 * default false, set true cache the request and response data after pipe.
 * if options.cache is a function, the argument will be the response object,
 * return true cache the response data, return false otherwise.
 * @param  {Boolean}        options.autoSameOriginRedirect
 * @param  {HttpResponse}   res
 * @return {Promise}  fullfiled with proxy request object
 */
function proxy(req, options, res) {
  const {
    timeout,
    modifyResponse,
    customOnResponse,
    skipModifyResponse,
    requestOptions
  } = getOptions(req, options);

  const reqCacheStream = new CacheStream();
  const httpRequest = getHttpRequest(requestOptions.protocol);
  const agentReq = req.pipe(reqCacheStream).pipe(httpRequest(requestOptions));

  debug('[proxy.Request] %o', requestOptions);

  return new Promise((resolve, reject) => {
    function _reject(err, extra) {
      err.proxyInfo = extra ? Object.assign({ reqCacheStream }, requestOptions, extra) : requestOptions;
      reject(err);
    }

    if (timeout && typeof timeout === 'number') {
      agentReq.on('socket', function (socket) {
        setReqTimeout(agentReq, socket, timeout);
      });
    }

    agentReq.once('error', err => {
      _reject(new ProxyRequestError('proxy request error', err));
    });

    agentReq.once('response', (agentRes) => {
      agentRes.options = requestOptions;
      if (isRedirecting(agentRes)
        && requestOptions.autoSameOriginRedirect
        && isSameOriginRedirect(agentRes)
      ) {
        // reset request stream
        reqCacheStream.resetReadable();
        const location = agentRes.headers.location;
        const urlObj = url.parse(location);
        const newOptions = Object.assign({}, requestOptions, {
          url: location,
          path: urlObj.path
        });

        const redirectReq = reqCacheStream.pipe(httpRequest(newOptions));
        redirectReq.once('response', (redirectRes) => {
          redirectRes.options = newOptions;
          redirectRes.redirectOptions = requestOptions;
          _onResponseCatched(redirectRes);
        });

        redirectReq.once('error', (err) => {
          _reject(new ProxyRequestError('proxy redirected request error', err));
        });
      } else {
        _onResponseCatched(agentRes);
      }
    });

    function _onResponseCatched(resp) {
      try {
        _onResponse(resp);
      } catch (err) {
        _reject(new ProxyRequestError('proxy handle response error', err));
      }
    }

    function _onResponse(agentRes) {
      pr.initResponseProps(agentRes);
      const {type, charset} = agentRes.contentType;
      const isCacheResponse = isCache(requestOptions.cache, agentRes);

      const srcHeaders = Object.assign({}, agentRes.headers);
      function _resReject(err, extra) {
        _reject(err, Object.assign({
          resCacheStream: agentRes,
          resHeaders: srcHeaders,
          resStatus: agentRes.statusCode,
        }, extra));
      }

      function _resolve(resp) {
        let resCacheStream = resp;
        if (!(resp instanceof CacheStream) && isCacheResponse) {
          resCacheStream = resp.pipe(new CacheStream());
          pr.copyResponseMeta(resp, resCacheStream);
        }

        resCacheStream.response = resp.response || resp;
        resCacheStream.reqCacheStream = reqCacheStream;

        pr.hackResponsePipe(resCacheStream);
        resolve(resCacheStream);

        if (res) resCacheStream.pipe(res);
      }

      debug('[proxy.Response] Status: %s\n Headers: %o', srcHeaders, agentRes.statusCode);


      try {
        customOnResponse && customOnResponse(agentRes);
      } catch (err) {
        _resReject(new ProxyRequestError('proxy options.onResponse error', err));
      }

      if (!modifyResponse
        || agentRes.isNoBody
        || (skipModifyResponse && skipModifyResponse(agentRes))
      ) {
        _resolve(agentRes);
        return;
      }

      // data unziped
      const unzipStream = rc.unzipHttpStream(agentRes);
      agentRes.contentEncoding = null;

      rc.readBody(unzipStream, type, charset)
        .then(body => {
          debug('[proxy.Response] Raw Body: %o', body);

          agentRes.body = body;

          new Promise((resolve, reject) => {
            const pro = modifyResponse(agentRes);
            if (pro && pro.then && pro.catch) {
              pro.then(resolve, reject);
            } else {
              resolve()
            }
          }).then(() => {
            const resStream = pr.createResponseStream(agentRes, isCacheResponse);
            _resolve(resStream);
          }, (err) => {
            _resReject(new ProxyRequestError('proxy options.modifyResponse error', err), {resBody: body});
          });

          debug('[proxy.Response] Modified Body: %o', agentRes.body);
        })
        .catch(err => _resReject(err, {resBody: err.text}));
    }
  });
}
