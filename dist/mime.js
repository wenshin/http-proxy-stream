'use strict';

var mime = require('mime-types');

exports.isUTF8 = function isUTF8(headers) {
  var contentType = headers['content-type'];
  if (!contentType) return false;

  var matched = contentType.match(/charset=([^=;]+)/i);
  var charset = void 0;
  if (matched) {
    charset = matched[1].trim();
  } else {
    charset = mime.charset(contentType);
  }
  return !!charset && charset.toLowerCase().replace('-', '') === 'utf8';
};

exports.isJSON = function isJSON(headers) {
  var contentType = headers['content-type'];
  if (!contentType) return false;

  return contentType.indexOf('json') > -1;
};