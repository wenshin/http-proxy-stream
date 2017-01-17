const debug = require('util').debuglog('proxy-request');
const url = require('url');
const http = require('http');
const mime = require('./mime');
const ct = require('content-type')
const ProxyRequestError = require('./error');
const CacheStream = require('./cache-stream');
const rc = require('./read-content');
const pr = require('./post-response');

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';


module.exports = proxy;
proxy.CacheStream = CacheStream;
proxy.ProxyRequestError = ProxyRequestError;

/**
 * proxy main method
 * @param  {HttpRequest}    req
 * @param  {Object}         options
 * the request options but not use callback
 * @param  {Function}       options.modifyResponse
 * a function has a chance to change response headers and body before pipe to dest
 * @param  {Function}       options.onResponse
 * a handler called once for 'response' event
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

  if (options.modifyResponse && typeof options.modifyResponse !== 'function') {
    throw new ProxyRequestError('options.modifyResponse must be a function');
  }

  if (options.onResponse && typeof options.onResponse !== 'function') {
    throw new ProxyRequestError('options.onResponse must be a function');
  }

  if (options.isUnzip && typeof options.isUnzip !== 'function') {
    throw new ProxyRequestError('options.isUnzip must be a function');
  }

  const reqCacheStream = new CacheStream();
  const agentReq = req.pipe(reqCacheStream).pipe(http.request(options));

  debug('[proxy.Request] %o', options);

  return new Promise((resolve, reject) => {
    function _reject(err, extra) {
      err.proxyInfo = extra ? Object.assign({reqCacheStream}, options, extra) : options;
      reject(err);
    }

    agentReq.on('error', (err) => {
      _reject(new ProxyRequestError('proxy request error', err));
    });

    agentReq.once('response', (agentRes) => {
      agentRes.options = options;

      if (isAutoRedirect(agentRes)) {
        reqCacheStream.resetReadable();
        const location = agentRes.headers.location;
        const urlObj = url.parse(location);
        const newOptions = Object.assgin({}, options, {
          url: location,
          path: urlObj.path
        });

        const redirectReq = reqCacheStream.pipe(http.request(newOptions));
        redirectReq.on('response', (redirectRes) => {
          redirectRes.options = newOptions;
          redirectRes.redirectOptions = options;
          onResponse(redirectRes);
        });

        redirectReq.on('error', (err) => {
          _reject(new ProxyRequestError('proxy redirected request error', err));
        })
      } else {
        onResponse(agentRes);
      }
    });

    function onResponse(agentRes) {
      const resCacheStream = new CacheStream();

      pr.initResponseProps(agentRes);
      const {type, parameters} = agentRes.contentType;

      const srcHeaders = Object.assign({}, agentRes.headers);
      function _resReject(err, extra) {
        _reject(err, Object.assign({
          resCacheStream,
          resHeaders: srcHeaders,
          resStatus: agentRes.statusCode,
        }, extra));
      }

      function _resolve(resp) {
        pr.hackResponsePipe(resp);
        resp.pipe(resCacheStream);

        pr.hackResponsePipe(resCacheStream);
        resolve(resCacheStream);
        if (res) resCacheStream.pipe(res);
      }

      debug('[proxy.Response] Status: %s\n Headers: %o', srcHeaders, agentRes.statusCode);


      try {
        options.onResponse && options.onResponse(agentRes);
      } catch (err) {
        _resReject(new ProxyRequestError('proxy options.onResponse error', err));
      }

      if (!options.modifyResponse
        || agentRes.isNoBody
        || (options.isUnzip && !options.isUnzip(agentRes))
      ) {
        _resolve(agentRes);
        return;
      }

      // data unziped
      const unzipStream = rc.unzipHttpStream(agentRes);
      agentRes.contentEncoding = null;

      rc.readBody(unzipStream, parameters.charset, function(text) {
        debug('[proxy.Response] Raw Body: %o', text);

        let body = text;
        try {
          body = rc.parseHttpBody(type, text);
        } catch (err) {
          _resReject(new ProxyRequestError('proxy parse body error', err), {resBody: text});
        }

        agentRes.body = body;

        try {
          options.modifyResponse(agentRes);
        } catch (err) {
          _resReject(new ProxyRequestError('proxy options.modifyResponse error', err), {resBody: text});
        }

        debug('[proxy.Response] Modified Body: %o', agentRes.body);

        const resStream = pr.createResponseStream(agentRes);
        _resolve(resStream);
      });

      unzipStream.on('error', err => {
        _resReject(new ProxyRequestError('proxy unzip error', err));
      });
    }
  });
}


function getHeadersFromRequest(req, extra = {}) {
  const {headers} = req;
  let ip = headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  ip = ip.split(':').slice(-1)[0];
  return Object.assign({}, headers, {
    connection: null,
    host: null,
    'x-forwarded-for': ip,
  }, extra);
}


function isAutoRedirect(res) {
  const urlObj = url.parse(res.headers.location || '');
  return res.statusCode === 301
    || res.statusCode === 302
    && urlObj.hostname === res.options.hostname
    && urlObj.port === res.options.port
    && urlObj.protocol === res.options.protocol;
}
