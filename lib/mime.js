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
  const {type, parameters} = ct.parse(contentType)
  const charset = parameters.charset || mimeLib.charsets.lookup(type);
  return {type, charset, parameters};
}


module.exports = {isText, isJSON, parseContentType};
