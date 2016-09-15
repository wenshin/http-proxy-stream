const mime = require('mime-types');

exports.isUTF8 = function isUTF8(headers) {
  const contentType = headers['content-type'];
  if (!contentType) return false;

  const matched = contentType.match(/charset=([^=;]+)/i);
  let charset;
  if (matched) {
    charset = matched[1].trim();
  } else {
    charset = mime.charset(contentType);
  }
  return !!charset && charset.toLowerCase().replace('-', '') === 'utf8';
};

exports.isJSON = function isJSON(headers) {
  const contentType = headers['content-type'];
  if (!contentType) return false;

  return contentType.indexOf('json') > -1;
}
