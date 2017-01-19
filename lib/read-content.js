const zlib = require('zlib');
const rawBody = require('raw-body');
const mime = require('./mime');
const ProxyRequestError = require('./error');


function unzipHttpStream(stream) {
  if (!stream.headers) throw new Error('unzip http stream need headers');

  let contentEncoding = stream.contentEncoding || 'identity'

  if (['gzip', 'deflate'].indexOf(contentEncoding) >-1) {
    return stream.pipe(zlib.Unzip());
  }
  return stream;
}


function readBody(unzipStream, charset) {
  return rawBody(unzipStream, charset);
}


function parseHttpBody(contentType, text) {
  let body = text;
  if (mime.isJSON(contentType)) {
    body = JSON.parse(text);
  }
  return body;
}


module.exports = {unzipHttpStream, readBody, parseHttpBody};
