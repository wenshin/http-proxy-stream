const debug = require('util').debuglog('proxy-request');
const url = require('url');
const http = require('http');
const mime = require('./mime');
const ProxyRequestError = require('./error');
const CacheStream = require('./cache-stream');
const rc = require('./read-content');
const pr = require('./post-response');
const setReqTimeout = require('./timeout');

module.exports = proxy;
proxy.CacheStream = CacheStream;
proxy.ProxyRequestError = ProxyRequestError;
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
  if (options.url) {
    const urlObj = url.parse(options.url);
    if (!urlObj.hostname) {
      throw new ProxyRequestError('url do not have hostname');
    }
    if (urlObj.protocol && urlObj.protocol !== 'http:') {
      throw new ProxyRequestError('only support http protocol');
    }
    options.hostname = urlObj.hostname;
    options.port = urlObj.port;
    options.path = urlObj.path;
  } else {
    options.url = `http://${options.hostname}${options.port ? ':' + options.port : ''}${options.path}`;
  }

  options.port = options.port || 80;
  options.protocol = options.protocol || 'http:';
  options.method = options.method || req.method;
  options.headers = getHeadersFromRequest(req, options.headers);

  if (options.skipModifyResponse && typeof options.skipModifyResponse !== 'function') {
    throw new ProxyRequestError('options.skipModifyResponse must be a function');
  }

  if (options.modifyResponse && typeof options.modifyResponse !== 'function') {
    throw new ProxyRequestError('options.modifyResponse must be a function');
  }

  if (options.onResponse && typeof options.onResponse !== 'function') {
    throw new ProxyRequestError('options.onResponse must be a function');
  }

  const skipModifyResponse = options.skipModifyResponse;
  const modifyResponse = options.modifyResponse;
  const customOnResponse = options.onResponse;
  const timeout = options.timeout;
  delete options.skipModifyResponse;
  delete options.modifyResponse;
  delete options.onResponse;
  delete options.timeout;

  const reqCacheStream = new CacheStream();
  const agentReq = req.pipe(reqCacheStream).pipe(http.request(options));

  debug('[proxy.Request] %o', options);

  return new Promise((resolve, reject) => {
    function _reject(err, extra) {
      err.proxyInfo = extra ? Object.assign({reqCacheStream}, options, extra) : options;
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
      agentRes.options = options;
      if (isRedirecting(agentRes)
        && options.autoSameOriginRedirect
        && isSameOriginRedirect(agentRes)
      ) {
        reqCacheStream.resetReadable();
        const location = agentRes.headers.location;
        const urlObj = url.parse(location);
        const newOptions = Object.assign({}, options, {
          url: location,
          path: urlObj.path
        });

        const redirectReq = reqCacheStream.pipe(http.request(newOptions));
        redirectReq.once('response', (redirectRes) => {
          redirectRes.options = newOptions;
          redirectRes.redirectOptions = options;
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
      const isCacheResponse = isCache(options.cache, agentRes);

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

          try {
            modifyResponse(agentRes);
          } catch (err) {
            _resReject(new ProxyRequestError('proxy options.modifyResponse error', err), {resBody: body});
            return;
          }

          debug('[proxy.Response] Modified Body: %o', agentRes.body);

          const resStream = pr.createResponseStream(agentRes, isCacheResponse);
          _resolve(resStream);
        })
        .catch(err => _resReject(err, {resBody: err.text}));
    }
  });
}


function getHeadersFromRequest(req, extra = {}) {
  const {headers} = req;
  let ip = headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  ip = ip.split(':').slice(-1)[0];
  return Object.assign({}, headers, extra, {
    connection: null,
    host: null,
    'x-forwarded-for': ip,
  });
}


function isRedirecting(res) {
  return res.statusCode === 301 || res.statusCode === 302;
}


function isSameOriginRedirect(res) {
  const urlObj = url.parse(res.headers.location || '');
  return urlObj.hostname === res.options.hostname
    && urlObj.port === res.options.port
    && urlObj.protocol === res.options.protocol;
}


function isCache(cache, response) {
  if (typeof cache === 'function') {
    return cache(response);
  }
  return !!cache;
}
