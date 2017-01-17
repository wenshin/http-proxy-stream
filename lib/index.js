const debug = require('util').debuglog('proxy-request');
const url = require('url');
const http = require('http');
const streamLib = require('stream');
const mime = require('./mime');
const ct = require('content-type')
const ProxyRequestError = require('./error');
const CacheStream = require('./cache-stream');
const rc = require('./read-content');

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
    options.port = urlObj.port || 80;
    options.path = urlObj.path;
  } else {
    options.url = `'http://${options.hostname}/${options.path}`;
  }
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

  const agentReq = req.pipe(http.request(options));

  debug('[proxy.Request] %o', options);

  return new Promise((resolve, reject) => {
    function _reject(err, extra) {
      err.proxyInfo = extra ? Object.assign({}, options, extra) : options;
      reject(err);
    }

    agentReq.on('error', (err) => {
      _reject(new ProxyRequestError('proxy request fail', err));
    });

    agentReq.once('response', (agentRes) => {
      const srcHeaders = Object.assign({}, agentRes.headers);
      function _resReject(err, extra) {
        _reject(err, Object.assign({
          resHeaders: srcHeaders,
          resStatus: agentRes.statusCode,
        }, extra));
      }

      debug('[proxy.Response] Status: %s\n Headers: %o', srcHeaders, agentRes.statusCode);

      agentRes.options = options;
      agentRes.contentEncoding = agentRes.headers['content-encoding'];
      agentRes.body = null;

      const noBody = isNoBody(agentRes.statusCode, options.method);
      const contentType = agentRes.headers['content-type'] || DEFAULT_CONTENT_TYPE;
      const {type, parameters} = ct.parse(contentType);
      parameters.charset = parameters.charset || mime.getDefaultCharset(type);

      try {
        options.onResponse && options.onResponse(agentRes);
      } catch (err) {
        _resReject(new ProxyRequestError('proxy options.onResponse error', err));
      }

      if (!options.modifyResponse || noBody || (options.isUnzip && !options.isUnzip(agentRes))) {
        hackResponsePipe(agentRes);
        resolve(agentRes);
        if (res) agentRes.pipe(res);
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

        const resStream = createResponseStream(agentRes);
        resolve(resStream);
        if (res) resStream.pipe(res);
      });

      unzipStream.on('error', err => {
        _resReject(new ProxyRequestError('proxy unzip error', err));
      });
    });
  });
}

function getHeadersFromRequest(req, extra = {}) {
  const {headers} = req;
  let ip = headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  ip = ip.split(':').slice(-1)[0];
  return Object.assign({}, headers, {
    host: null,
    'x-forwarded-for': ip,
  }, extra);
}


function isNoBody(code, method) {
  return (
    method === 'HEAD'
    // Informational
    || (code >= 100 && code < 200)
    // No Content
    || code === 204
    // Not Modified
    || code === 304
  )
}


function createResponseStream(response) {
  let data = response.body || '';

  const needJSONStringify = data
    && typeof data === 'object'
    && !(data instanceof Buffer);

  data = needJSONStringify ? JSON.stringify(data) : data;
  data = Buffer.from(data);

  const readable = new streamLib.Readable({
    read() {
      this.push(data);
      this.push(null);
    }
  });

  readable.headers = response.headers;
  readable.statusCode = response.statusCode;
  readable.statusMessage = response.statusMessage;
  // data unzipped
  readable.contentEncoding = null;
  readable.body = data;

  hackResponsePipe(readable);

  return readable;
}


function hackResponsePipe(res) {
  const oldPipe = res.pipe;
  res.pipe = function pipe(dest) {
    pipeResponseMeta(res, dest);
    oldPipe.call(res, dest);
  }
}


/**
 * Copy from request library. https://github.com/request/request
 */
function pipeResponseMeta(res, dest) {
  // use http default encoding
  delete res.headers['content-length'];
  delete res.headers['transfer-encoding'];

  if (dest.headersSent) return;

  if (dest.setHeader) {
    for (const key of Object.keys(res.headers)) {
      dest.setHeader(key, res.headers[key]);
    }
    if (res.contentEncoding) {
      dest.setHeader('content-encoding', res.contentEncoding);
    }
  } else {
    if (dest.headers) {
      Object.assgin(dest.headers, res.headers);
    } else {
      dest.headers = res.headers;
    }
    if (res.contentEncoding) {
      dest.headers['content-encoding'] = res.contentEncoding;
    }
  }

  dest.statusCode = res.statusCode;
  dest.statusMessage = res.statusMessage;
}
