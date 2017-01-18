const zlib = require('zlib');
const iconv = require('iconv-lite');
const mime = require('./mime');


function unzipHttpStream(stream) {
  if (!stream.headers) throw new Error('unzip http stream need headers');

  let contentEncoding = stream.headers['content-encoding'] || 'identity'
  contentEncoding = contentEncoding.trim().toLowerCase()

  let unzipStream = stream;
  if (contentEncoding === 'gzip') {
    unzipStream = stream.pipe(zlib.createGunzip());
  } else if (contentEncoding === 'deflate') {
    unzipStream = stream.pipe(zlib.createInflate());
  }
  return unzipStream;
}


function readBody(unzipStream, charset, callback) {
  let rawStream = unzipStream;
  if (charset) {
    rawStream = unzipStream.pipe(iconv.decodeStream(charset));
  }

  let text = '';
  rawStream.on('data', (chunk) => {
    if (chunk instanceof Buffer) {
      text = Buffer.concat([Buffer.from(text), chunk]);
    } else {
      text += chunk;
    }
  });
  rawStream.on('end', () => {
    callback(text);
  });
}


function parseHttpBody(contentType, text) {
  let body = text;
  if (mime.isJSON(contentType)) {
    body = JSON.parse(text);
  }
  return body;
}


module.exports = {unzipHttpStream, readBody, parseHttpBody};
