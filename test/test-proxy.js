const fs = require('fs');
const path = require('path');
const assert = require('assert');
const stream = require('stream');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);
console.log(`test in ../${process.env.TEST_DIR || 'lib'}`)

describe('proxy-request default', function () {
  it('proxy(req, {url}, res) http', function (done) {
    utils.test(function(req, res) {
      proxy(req, {url: `http://127.0.0.1:${this.upstream.port}`}, res)
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    });
  });

  it('proxy(req, {url}, res) https', function (done) {
    utils.test(function (req, res) {
      proxy(req, {
        url: `https://localhost:${this.upstream.port}`,
        ca: fs.readFileSync(path.join(__dirname, 'assets/ca/cert.pem'))
      }, res)
    }, function () {
      const ctx = this;
      utils.get.call(this, null, function (res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    }, {
      type: 'https'
    });
  });

  it('proxy(req, {url}).then(response => response.pipe(res))', function (done) {
    utils.test(function(req, res) {
      const port = this.upstream.port;
      proxy(req, {
        url: `http://localhost:${port}`,
        cache(resp) {
          assert.equal(resp.constructor.name, 'IncomingMessage');
          return true;
        }
      })
        .then(resp => {
          assert.equal(resp.response.constructor.name, 'IncomingMessage');
          assert.equal(resp.options.hostname, 'localhost');
          assert.equal(resp.options.port, port);
          assert.ok(resp instanceof stream.Stream);
          assert.ok(resp instanceof proxy.CacheStream);
          assert.equal(resp.srcHeaders['transfer-encoding'], 'chunked');
          assert.ok(resp.reqCacheStream instanceof proxy.CacheStream);
          assert.equal(resp.pipe(res), res);
        })
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.headers['content-type'], ctx.upstream.headers['content-type']);
        assert.ok(!res.headers['content-length']);
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    });
  });

  it('proxy(req, {url, onResponse}).then(response => response.pipe(res))', function (done) {
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        onResponse(response) {
          assert.equal(response.headers['content-length'], ctx.upstream.successText.length);
          response.headers.test = 'test';
        }
      })
        .then(response => {
          assert.equal(response.response.constructor.name, 'IncomingMessage');
          response.pipe(res);
        })
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.headers['content-length'], ctx.upstream.successText.length);
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        assert.equal(res.headers.test, 'test');
        done()
      });
    }, {isChunked: false});
  });

  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        modifyResponse() {
          return;
        }
      }, res).catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.ok(!res.headers['content-encoding']);
        assert.ok(res.headers['content-length']);
        assert.deepEqual(JSON.parse(body), JSON.parse(ctx.upstream.successText));
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], ctx.upstream.headers['content-type']);
        done()
      });
    }, {isChunked: false});
  });

  it('proxy(req, {url, modifyResponse}, res) unziped stream will not have content-encoding gzip', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}/json`,
        modifyResponse(response) {
          response.headers.test = 'test';
        }
      }, res).catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.ok(!res.headers['content-encoding']);
        assert.ok(res.headers['content-length']);
        assert.deepEqual(JSON.parse(body), JSON.parse(ctx.upstream.successText));
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], ctx.upstream.headers['content-type']);
        assert.equal(res.headers.test, 'test');
        done()
      });
    }, 'createMockFileServer', {isChunked: false});
  });

  it('proxy(req, {url, modifyResponse}, res) set invalid header in modify response', function (done) {
    const INVALID_HEADER = '/path/to?q=中国';
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}/json`,
        modifyResponse(response) {
          response.headers.test = INVALID_HEADER;
        }
      }, res).catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res) {
        assert.equal(res.headers['test'], encodeURI(INVALID_HEADER));
        done()
      });
    }, 'createMockFileServer', {isChunked: false});
  });

  it('proxy(req, {url}, res) will keep content-encoding gzip without modifyResponse config', function (done) {
    utils.test(function(req, res) {
      proxy(req, {url: `http://localhost:${this.upstream.port}`}, res)
        .catch(err => console.log(err));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.ok(!res.headers['content-length']);
        assert.equal(res.headers['transfer-encoding'], 'chunked');
        assert.equal(res.headers['content-encoding'], 'gzip');
        assert.equal(res.headers['content-type'], ctx.upstream.headers['content-type']);
        assert.equal(body, ctx.upstream.successTextGziped);
        assert.equal(res.statusCode, 200);
        done()
      });
    }, 'createMockFileServer', {isChunked: false});
  });

  it('proxy(req, {url}, res) timeout', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        timeout: 10
      }, res)
        .catch(err => {
          assert.ok(err instanceof proxy.ProxyRequestError);
          assert.equal(err.code, 'ESOCKETTIMEDOUT');
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

  it('proxy(req, {url}, res) upstream server abort', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`
      }).then((resp) => {
        resp.pipe(res);
        resp.emit('aborted');
      })
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, null, function(err) {
        assert.ok(err);
        done()
      });
    });
  });
});
