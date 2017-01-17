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

  it('proxy(req, {url}).then(request => request.pipe(res))', function (done) {
    utils.test(function(req, res) {
      const port = this.address().port;
      proxy(req, {url: `http://localhost:${port}`})
        .then(request => {
          assert.equal(request.response.constructor.name, 'IncomingMessage');
          assert.equal(request.options.hostname, 'localhost');
          assert.equal(request.options.port, port);
          assert.ok(request instanceof stream.Stream);
          assert.ok(request instanceof proxy.CacheStream);
          assert.ok(request.reqCacheStream instanceof proxy.CacheStream);
          assert.equal(request.pipe(res), res);
        })
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        done()
      });
    });
  });

  it('proxy(req, {url, onResponse}).then(request => request.pipe(res))', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        onResponse(response) {
          response.headers.test = 'test';
        }
      })
        .then(request => {
          request.pipe(res);
        });
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });
});
