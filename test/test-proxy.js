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

  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          return;
        }
      }, res).catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.headers['transfer-encoding'], 'chunked');
        assert.ok(!res.headers['content-encoding']);
        assert.ok(!res.headers['content-length']);
        assert.deepEqual(JSON.parse(body), JSON.parse(ctx.s.successText));
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], ctx.s.headers['content-type']);
        done()
      });
    }, {isChunked: false});
  });

  it('proxy(req, {url, modifyResponse}, res) unziped stream will not have content-encoding gzip', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}/json`,
        modifyResponse(response) {
          response.headers.test = 'test';
        }
      }, res).catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.headers['transfer-encoding'], 'chunked');
        assert.ok(!res.headers['content-encoding']);
        assert.ok(!res.headers['content-length']);
        assert.deepEqual(JSON.parse(body), JSON.parse(ctx.s.successText));
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], ctx.s.headers['content-type']);
        assert.equal(res.headers.test, 'test');
        done()
      });
    }, 'createMockFileServer', {isChunked: false});
  });

  it('proxy(req, {url}, res) will keep content-encoding gzip', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {url: `http://localhost:${this.address().port}`}, res)
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.ok(!res.headers['content-length']);
        assert.equal(res.headers['transfer-encoding'], 'chunked');
        assert.equal(res.headers['content-encoding'], 'gzip');
        assert.equal(res.headers['content-type'], ctx.s.headers['content-type']);
        assert.equal(body, ctx.s.successTextGziped);
        assert.equal(res.statusCode, 200);
        done()
      });
    }, 'createMockFileServer', {isChunked: false});
  });
   it('proxy(req, {url}, res) timeout', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        timeout: 10
      }, res)
        .catch(err => {
          console.log(err);
          assert.ok(err instanceof Error);
          res.end();
        });
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        // TODO timeout case
        done()
      });
    }, {delay: 50});
  });
});
