const url = require('url');
const ProxyRequestError = require('./error');

module.exports = getOptions;

function getOptions(req, options) {
  options.protocol = options.protocol || 'http:';
  options.method = options.method || req.method;
  options.headers = getHeadersFromRequest(req, options.headers);

  if (options.url) {
    const urlObj = url.parse(options.url);
    if (!urlObj.hostname) {
      throw new ProxyRequestError('url do not have hostname');
    }
    options.hostname = urlObj.hostname;
    options.protocol = urlObj.protocol;
    options.port = urlObj.port;
    options.path = urlObj.path;
  } else {
    options.url = url.format(options);
  }

  if (options.skipModifyResponse && typeof options.skipModifyResponse !== 'function') {
    throw new ProxyRequestError('options.skipModifyResponse must be a function');
  }

  if (options.modifyResponse && typeof options.modifyResponse !== 'function') {
    throw new ProxyRequestError('options.modifyResponse must be a function');
  }

  if (options.onResponse && typeof options.onResponse !== 'function') {
    throw new ProxyRequestError('options.onResponse must be a function');
  }

  const skipModifyResponse = options.skipModifyResponse;
  const modifyResponse = options.modifyResponse;
  const customOnResponse = options.onResponse;
  const timeout = options.timeout;
  delete options.skipModifyResponse;
  delete options.modifyResponse;
  delete options.onResponse;
  delete options.timeout;

  return {
    timeout,
    modifyResponse,
    customOnResponse,
    skipModifyResponse,
    requestOptions: options
  };
}

function getHeadersFromRequest(req, extra = {}) {
  const { headers } = req;
  let ip = headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  ip = ip.split(':').slice(-1)[0];
  return Object.assign({}, headers, extra, {
    connection: null,
    host: null,
    'x-forwarded-for': ip,
  });
}
