const http = require('http');
const server = require('./server');

exports.test = function test(testCase, request, serverName, serverConfig) {
  if (typeof serverName !== 'string') {
    serverConfig = serverName;
    serverName = 'createMockServer';
  }
  const s = server[serverName](serverConfig);

  s.server = http.createServer((req, res) => {
    s.listen(s.port, function() {
      this.s = s;
      try {
        testCase.call(this, req, res)
      } catch (e) {
        res.writeHead(500);
        res.end('Test Case Fail');
      }
    });
  }).listen(s.port - 1, function() {
    this.s = s;
    request.call(this);
  });
};

exports.get = function(options, handleEnd) {
  const ctx = this;
  options = options || {
    path: '/',
    host: 'localhost',
    port: ctx.s.port - 1
  };
  const get = http.get(options, function(res) {
    let data = '';
    res.setEncoding('utf8')
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      ctx.s.server.close();
      ctx.s.close();
      handleEnd(res, data);
    });
  });
  get.on('error', (err) => {
    ctx.s.server.close();
    ctx.s.close();
    console.log('get error', err)
  });
  get.end();
}
