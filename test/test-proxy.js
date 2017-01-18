const assert = require('assert');
const stream = require('stream');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);
console.log(`test in ../${process.env.TEST_DIR || 'lib'}`)

describe('proxy-request default', function () {
  it('proxy(req, {url}, res)', function (done) {
    utils.test(function(req, res) {
      proxy(req, {url: `http://localhost:${this.address().port}`}, res)
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        done()
      });
    });
  });

  it('proxy(req, {url}).then(response => response.pipe(res))', function (done) {
    utils.test(function(req, res) {
      const port = this.address().port;
      proxy(req, {url: `http://localhost:${port}`})
        .then(response => {
          assert.equal(response.response.constructor.name, 'IncomingMessage');
          assert.equal(response.options.hostname, 'localhost');
          assert.equal(response.options.port, port);
          assert.ok(response instanceof stream.Stream);
          assert.ok(response instanceof proxy.CacheStream);
          assert.equal(response.srcHeaders['transfer-encoding'], 'chunked');
          assert.ok(response.reqCacheStream instanceof proxy.CacheStream);
          assert.equal(response.pipe(res), res);
        })
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.headers['content-type'], ctx.s.headers['content-type']);
        assert.ok(!res.headers['content-length']);
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        done()
      });
    });
  });

  it('proxy(req, {url, onResponse}).then(response => response.pipe(res))', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        onResponse(response) {
          assert.equal(response.headers['content-length'], ctx.s.successText.length);
          response.headers.test = 'test';
        }
      })
        .then(response => {
          response.pipe(res);
        })
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.headers['transfer-encoding'], 'chunked');
        assert.ok(!res.headers['content-length']);
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        assert.equal(res.headers.test, 'test');
        done()
      });
    }, {isChunked: false});
  });
});
