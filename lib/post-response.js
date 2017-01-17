const stream = require('stream');


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


module.exports = {createResponseStream, hackResponsePipe, pipeResponseMeta};
