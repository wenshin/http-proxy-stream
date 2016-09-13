const http = require('http');
const server = require('./server');

exports.test = function test(testCase, trigger, serverConfig) {
  const s = server.createMockServer(serverConfig);

  http.createServer((req, res) => {
    s.listen(s.port, function() {
      this.s = s;
      testCase.call(this, req, res)
    })
  }).listen(0, function() {
    this.s = s;
    trigger.call(this);
  });
};

exports.get = function(options, handleEnd) {
  const ctx = this;
  options = options || {
    path: '/',
    host: 'localhost',
    port: ctx.address().port
  };
  const get = http.get(options, function(res) {
    let data = '';
    res.setEncoding('utf8')
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      ctx.s.close();
      handleEnd(res, data);
    });
  });
  get.on('error', (e) => {throw e;});
  get.end();
}
