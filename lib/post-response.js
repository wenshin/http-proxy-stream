const mime = require('./mime');
const ProxyError = require('./error');

function hackResponsePipe(res) {
  const oldPipe = res.pipe;
  res.pipe = function pipe(dest) {
    if (!dest.writable) return;
    // deal with upstream server abort
    res.once('aborted', () => {
      const err = new ProxyError('upstream server aborted');
      err.code = ProxyError.ERR_UPSTREAM_SERVER_ABORTED;
      res.destroy(err);
      dest.destroy(err);
      dest.emit('aborted')
    });
    // deal with client abort
    dest.on('close', () => {
      res.destroy();
      res.emit('close');
      dest.destroy();
    })
    copyResponseMeta(res, dest);
    hackResponsePipe(dest);
    return oldPipe.call(res, dest);
  }
}

/**
 * Copy from request library. https://github.com/request/request
 */
function copyResponseMeta(res, dest) {
  if (!res.headers || dest.headersSent) return;

  if (dest.setHeader) {
    for (const key of Object.keys(res.headers)) {
      if (key !== 'content-encoding') {
        setHeader(dest, key, res.headers[key]);
      }
    }
    if (res.contentEncoding) {
      setHeader(dest, 'content-encoding', res.contentEncoding);
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
  dest.srcHeaders = res.srcHeaders || res.headers;

  dest.options = res.options;
  dest.redirectOptions = res.redirectOptions;

  dest.statusCode = res.statusCode;
  dest.statusMessage = res.statusMessage;
}

function setHeader(stream, name, value) {
  if (!value) return;
  try {
    stream.setHeader(name, value);
  } catch (err) {
    // node will treat "location: /search/?q=中国" which having chinese text,
    // as a invalid header value
    stream.setHeader(name, encodeURI(value))
  }
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
  hackResponsePipe,
  copyResponseMeta,
  initResponseProps,
  isNoBody
};
