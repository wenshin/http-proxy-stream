const mime = require('./mime');
const CacheStream = require('./cache-stream');


function createResponseStream(response, isCache) {
  let data = response.body || '';

  const needJSONStringify = data
    && typeof data === 'object'
    && !(data instanceof Buffer);

  data = needJSONStringify ? JSON.stringify(data) : data;

  const stream = new CacheStream({cacheActive: isCache});
  stream.end(data);

  copyResponseMeta(response, stream);
  stream.body = response.body;
  stream.response = response;
  return stream;
}


function hackResponsePipe(res) {
  const oldPipe = res.pipe;
  res.pipe = function pipe(dest) {
    if (!dest.writable) return;
    copyResponseMeta(res, dest);
    hackResponsePipe(dest);
    return oldPipe.call(res, dest);
  }
}


/**
 * Copy from request library. https://github.com/request/request
 */
function copyResponseMeta(res, dest) {
  // all response change to chunked transfer
  delete res.headers['content-length'];
  delete res.headers['transfer-encoding'];

  if (dest.headersSent) return;

  if (dest.setHeader) {
    for (const key of Object.keys(res.headers)) {
      if (key !== 'content-encoding') {
        dest.setHeader(key, res.headers[key]);
      }
    }
    if (res.contentEncoding) {
      dest.setHeader('content-encoding', res.contentEncoding);
    }
  } else {
    if (dest.headers) {
      Object.assign(dest.headers, res.headers);
    } else {
      dest.headers = res.headers;
    }
    if (res.contentEncoding) {
      dest.headers['content-encoding'] = res.contentEncoding;
    } else {
      delete dest.headers['content-encoding'];
    }
  }

  // isNoBody type checked by proxy
  dest.isNoBody = res.isNoBody;
  // the content type data parsed by proxy
  dest.contentType = res.contentType;
  dest.contentEncoding = res.contentEncoding;
  dest.srcHeaders = res.srcHeaders;

  dest.options = res.options;
  dest.redirectOptions = res.redirectOptions;

  dest.statusCode = res.statusCode;
  dest.statusMessage = res.statusMessage;
}


const DEFAULT_CONTENT_TYPE = 'application/octet-stream';


function initResponseProps(res) {
  const noBody = isNoBody(res.statusCode, res.options.method);
  const contentType = res.headers['content-type'] || DEFAULT_CONTENT_TYPE;

  res.body = null;
  res.isNoBody = noBody;
  res.contentType = mime.parseContentType(contentType);
  res.srcHeaders = Object.assign({}, res.headers);
  if (res.headers['content-encoding']) {
    res.contentEncoding = res.headers['content-encoding'].trim().toLowerCase();
  }
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

module.exports = {
  createResponseStream,
  hackResponsePipe,
  copyResponseMeta,
  initResponseProps,
  isNoBody
};
