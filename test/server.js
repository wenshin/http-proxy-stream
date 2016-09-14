const http = require('http');

exports.createMockServer = function createMockServer(config) {
  config = Object.assign({
    contentType: 'application/json; charset=utf-8',
    successText: '{"success": true}',
    failText: '{"success": true}',
    port: 0
  }, config || {});

  const s = http.createServer((req, res) => {
    const matched = req.url.match(/status=(\d+)/i) || [];
    const status = matched[1] || 200;
    res.writeHead(status, s.headers);
    let content = config.successText;
    if (status >= 400) content = config.failText;
    res.end(content)
  });
  s.headers = {'content-type': config.contentType, test: 'test header'};
  s.successText = config.successText;
  s.failText = config.failText;
  s.port = config.port;
  return s;
}
