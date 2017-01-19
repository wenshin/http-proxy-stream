const ct = require('content-type')
const mimeLib = require('mime-types');

function isText(mime) {
  if (mime.indexOf('text/') === 0) {
    return true;
  }

  if (isJSON(mime)
    || mime.indexOf('application/javascript') === 0
    || mime.indexOf('application/xml') === 0
    || mime.indexOf('application/xhtml+xml') === 0
  ) {
    return true;
  }

  return false;
}


function isJSON(mime) {
  return mime.indexOf('json') > -1
    || mime.indexOf('application/csp-report') === 0;
}


function parseContentType(contentType) {
  const {type, parameters} = ct.parse(contentType);
  // may some one will set content tyoe application/octet-stream; charset=UTF-8.
  // so when the mime not the text type, we use mimeLib.charsets.lookup to get charset
  const charset = isText(type) && parameters.charset || mimeLib.charsets.lookup(type);
  return {type, charset, parameters};
}


module.exports = {isText, isJSON, parseContentType};
