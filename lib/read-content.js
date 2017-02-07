const zlib = require('zlib');
const rawBody = require('raw-body');
const mime = require('./mime');
const ProxyRequestError = require('./error');


function unzipHttpStream(stream) {
  if (!stream.headers) throw new Error('unzip http stream need headers');

  let contentEncoding = stream.contentEncoding || 'identity'

  if (['gzip', 'deflate'].indexOf(contentEncoding) > -1) {
    return stream.pipe(zlib.Unzip());
  }
  return stream;
}


function readBody(unzipStream, contentType, charset) {
  return rawBody(unzipStream, charset)
    .then(text => {
      try {
        return parseHttpBody(text, contentType);
      } catch (err) {
        const newErr = new ProxyRequestError('parse response body error', err);
        newErr.text = text;
        throw newErr;
      }
    });
}


function parseHttpBody(text, contentType) {
  let body = text;
  if (mime.isJSON(contentType)) {
    body = JSON.parse(text);
  }
  return body;
}


module.exports = {unzipHttpStream, readBody, parseHttpBody};
