const http = require('http');
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

const PORT = 8777;

exports.createMockServer = function createMockServer(config) {
  config = Object.assign({
    contentType: 'application/json; charset=utf-8',
    successText: '{"success": true}',
    failText: '{"success": true}',
    port: PORT
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

exports.createMockFileServer = function createMockFileServer(config) {
  config = Object.assign({
    filePath: path.join(__dirname, '/assets/test.xlsx'),
    contentType: 'application/vnd.ms-excel',
    port: PORT
  }, config || {});

  const filename = path.basename(config.filePath);

  const s = http.createServer((req, res) => {
    fs.readFile(config.filePath, function(err, data) {
      s.successText = data;
      zlib.gzip(data, function(err, gzip) {
        res.writeHead(200, {
          'Content-Type': config.contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Encoding': 'gzip'
        });
        res.end(gzip);
      });
    });
  });
  s.headers = {'content-type': config.contentType};
  s.filename = filename;
  s.port = config.port;
  return s;
}
