const http = require('http');
const server = require('./server');

exports.test = function test(testCase, request, serverName, serverConfig) {
  if (typeof serverName !== 'string') {
    serverConfig = serverName;
    serverName = 'createMockServer';
  }
  // create target server
  const upstream = server[serverName](serverConfig);

  // create proxy server
  const proxy = http.createServer((req, res) => {
    upstream.listen(0, function() {
      upstream.port = upstream.address().port;
      const ctx = { proxy, upstream }
      try {
        testCase.call(ctx, req, res)
      } catch (err) {
        res.writeHead(500);
        console.log('testCase error', err)
        res.end('Test Case Fail');
      }
    });
  }).listen(0, function() {
    const ctx = { proxy, upstream}
    proxy.port = proxy.address().port;
    request.call(ctx);
  });
};

exports.get = function get(options, handleEnd, handleError) {
  const ctx = this;
  options = options || {
    path: '/',
    host: 'localhost',
    port: ctx.proxy.port
  };

  const req = http.get(options, function (res) {
    let data = '';
    res.setEncoding('utf8')
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      ctx.proxy.close();
      ctx.upstream.close();
      handleEnd && handleEnd(res, data);
    });
  });
  req.on('error', (err) => {
    ctx.proxy.close();
    ctx.upstream.close();
    handleError ? handleError(err) : console.log('get error', err);
  });
  req.end();
}
