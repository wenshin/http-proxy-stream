const http = require('http');

exports.createMockServer = function createMockServer(port) {
  const s = http.createServer((req, res) => {
    const matched = req.url.match(/status=(\d+)/i) || [];
    const status = matched[1] || 200;
    res.writeHead(status, s.headers);
    let content = s.successText;
    if (status >= 400) content = s.failText;
    res.end(content)
  });
  s.headers = {'content-type': 'application/json; charset=utf8', test: 'test header'};
  s.successText = '{"success": true}';
  s.failText = '{"success": false}';
  s.port = port || 0;
  return s;
}
