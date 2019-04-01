const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

const PORT = 8777;
const SUCC_TEXT = '{"success": true}';
const FAIL_TEXT = '{"success": false}';

exports.createMockServer = function createMockServer(config) {
  config = Object.assign({
    isChunked: true,
    contentType: 'application/json; charset=utf-8',
    successText: SUCC_TEXT,
    failText: FAIL_TEXT,
    port: PORT,
    type: 'http'
  }, config || {});

  const s = createServer((req, res) => {
    const matched = req.url.match(/status=(\d+)/i) || [];
    const status = matched[1] || 200;
    let content = config.successText;
    if (status >= 400) content = config.failText;

    if (config.isChunked) {
      s.headers['transfer-encoding'] = 'chunked';
    } else {
      s.headers['content-length'] = content.length;
    }

    if (config.delay) {
      setTimeout(() => {
        console.log('[TEST SERVEF] timeout response', config.delay)
        res.writeHead(status, s.headers);
        res.end(content);
      }, config.delay)
    } else {
      res.writeHead(status, s.headers);
      res.end(content);
    }
  }, config.type, config);
  s.headers = {'content-type': config.contentType, test: 'test header'};
  s.successText = config.successText;
  s.failText = config.failText;
  s.port = config.port;
  return s;
}

exports.createMockFileServer = function createMockFileServer(config) {
  config = Object.assign({
    filePath: path.join(__dirname, '/assets/test.xlsx'),
    port: PORT,
    type: 'http'
  }, config || {});

  const filename = path.basename(config.filePath);

  const s = createServer((req, res) => {
    if (req.url.indexOf('/json') > -1) {
      config.contentType = 'application/json;';
      zlib.gzip(SUCC_TEXT, function(err, gzip) {
        res.writeHead(200, {
          'Content-Type': config.contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Encoding': 'gzip'
        });
        s.successText = SUCC_TEXT;
        s.successTextGziped = gzip.toString();
        res.end(gzip);
      });
    } else {
      // 注意，最后的 '; ' 是模拟错误的 contentType 场景
      config.contentType = 'application/vnd.ms-excel;  ';
      fs.readFile(config.filePath, function(err, data) {
        zlib.gzip(data, function(err, gzip) {
          res.writeHead(200, {
            'Content-Type': config.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Encoding': 'gzip'
          });
          s.successText = data;
          s.successTextGziped = gzip.toString();
          res.end(gzip);
        });
      });
    }
    s.headers = {'content-type': config.contentType};
  }, config.type, config);
  s.filename = filename;
  s.port = config.port;
  return s;
}


exports.createRedirectServer = function createRedirectServer(config) {
  config = Object.assign({
    code: 301,
    port: PORT,
    type: 'http'
  }, config || {});

  const s = createServer((req, res) => {
    if (req.url.indexOf('/redirected') > -1) {
      res.writeHead(200, {
        'content-type': 'text/plain'
      });
      res.end('redirected');
    } else {
      res.writeHead(config.code, {
        location: `http://${req.headers.host}/redirected`
      });
      res.end(null);
    }
  }, config.type, config);

  s.successText = 'redirected';
  s.port = config.port;
  return s;
}

exports.createServer = createServer;

function createServer(handler, type, options) {
  let s;
  if (type === 'http') {
    s = http.createServer(handler);
  } else {
    const opts = Object.assign({
      key: fs.readFileSync(path.join(__dirname, 'assets/ca/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'assets/ca/cert.pem')),
    }, options);
    s = https.createServer(opts, handler);
  }
  return s;
}
