const url = require('url');
const http = require('http');
const https = require('https');

function getHttpRequest(protocol) {
  return protocol === 'https:' ? https.request : http.request;
}

function isRedirecting(res) {
  return res.statusCode === 301 || res.statusCode === 302;
}

function isSameOriginRedirect(res) {
  const urlObj = url.parse(res.headers.location || '');
  return urlObj.hostname === res.options.hostname
    && urlObj.port === res.options.port
    && urlObj.protocol === res.options.protocol;
}

function isCache(cache, response) {
  if (typeof cache === 'function') {
    return cache(response);
  }
  return !!cache;
}

module.exports = {
  getHttpRequest,
  isRedirecting,
  isSameOriginRedirect,
  isCache,
}
