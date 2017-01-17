const mimeLib = require('mime-types');

exports.isText = function isText(mime) {
  if (mime.indexOf('text/') === 0) {
    return true;
  }

  if (mime === 'application/json'
    || mime === 'application/javascript'
    || mime === 'application/xml'
    || mime === 'application/xhtml+xml'
  ) {
    return true;
  }

  return false;
}


exports.isJSON = function isJSON(mime) {
  return mime.indexOf('json') > -1;
};


exports.getDefaultCharset = function getDefaultCharset(mime) {
  return mimeLib.charsets.lookup(mime);
}
