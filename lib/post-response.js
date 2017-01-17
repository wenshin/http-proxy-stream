const stream = require('stream');
const ct = require('content-type')
const mime = require('./mime');


function createResponseStream(response) {
  let data = response.body || '';

  const needJSONStringify = data
    && typeof data === 'object'
    && !(data instanceof Buffer);

  data = needJSONStringify ? JSON.stringify(data) : data;
  data = Buffer.from(data);

  const readable = new stream.Readable({
    read() {
      this.push(data);
      this.push(null);
    }
  });

  copyResponseMeta(response, readable);
  readable.contentEncoding = null;
  readable.body = data;
  readable.response = response;
  return readable;
}


function hackResponsePipe(res) {
  const oldPipe = res.pipe;
  res.pipe = function pipe(dest) {
    copyResponseMeta(res, dest);
    oldPipe.call(res, dest);
  }
}


/**
 * Copy from request library. https://github.com/request/request
 */
function copyResponseMeta(res, dest) {
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

  // isNoBody type checked by proxy
  dest.isNoBody = res.isNoBody;
  // the content type data parsed by proxy
  dest.contentType = res.contentType;
  dest.options = res.options;
  dest.redirectOptions = res.redirectOptions;

  dest.statusCode = res.statusCode;
  dest.statusMessage = res.statusMessage;
}


const DEFAULT_CONTENT_TYPE = 'application/octet-stream';


function initResponseProps(res) {
  const noBody = isNoBody(res.statusCode, res.options.method);
  const contentType = res.headers['content-type'] || DEFAULT_CONTENT_TYPE;
  const {type, parameters} = ct.parse(contentType);
  parameters.charset = parameters.charset || mime.getDefaultCharset(type);

  res.isNoBody = noBody;
  res.contentType = {type, parameters};
  res.contentEncoding = res.headers['content-encoding'];
  res.body = null;
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
