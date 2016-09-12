const assert = require('assert');
const http = require('http');
const server = require('./server');
const proxy = require('../lib');

describe('proxy-request', function () {
  it('should proxy with res', function (done) {
    const s = server.createMockServer();

    http.createServer((req, res) => {
      s.listen(s.port, function() {
        proxy(req, {url: `http://localhost:${this.address().port}`}, res)
      })
    }).listen(0, function() {
      const get = http.get({
        path: '/',
        host: 'localhost',
        port: this.address().port
      }, function(res) {
        assert.equal(res.statusCode, 200);
        let data = '';
        res.setEncoding('utf8')
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          assert.equal(data, s.successText);
          done()
        });
      });
      get.on('error', (e) => {throw e;});
      get.end();
    });
  });
});
