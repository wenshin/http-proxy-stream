const assert = require('assert');
const stream = require('stream');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);

describe('proxy-request-modify', function () {
  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = MODIFIED;
        }
      }, res)
        .catch(err => console.log(err));
    }, function() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url, modifyResponse}, res) modifyResponse return promise', function (done) {
    const MODIFIED = 'modified';
    utils.test(function (req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = MODIFIED;
          return Promise.resolve();
        }
      }, res)
        .catch(err => console.log(err));
    }, function () {
      utils.get.call(this, null, function (res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url, skipModifyResponse, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        skipModifyResponse(response) {
          return !proxy.mime.isText(response.contentType.type);
        },
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = MODIFIED;
        }
      }, res)
        .catch(err => console.log(err));
    }, function() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.ok(!res.headers.test);
        done()
      });
    }, 'createMockFileServer');
  });


  it('proxy(req, {url, modifyResponse}).then(request => request.pipe(res))', function (done) {
    const modified = {a: 1};
    utils.test(function(req, res) {
      const ctx = this;
      const port = ctx.upstream.port;
      proxy(req, {
        url: `http://localhost:${port}`,
        cache: true,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = modified;
        }
      }).then(response => {
        assert.equal(response.response.constructor.name, 'IncomingMessage');
        assert.equal(response.options.hostname, 'localhost');
        assert.equal(response.options.port, port);
        assert.ok(response instanceof stream.Stream);
        assert.ok(response instanceof proxy.CacheStream);
        assert.ok(response.reqCacheStream instanceof proxy.CacheStream);
        assert.deepEqual(response.body, modified);
        assert.equal(response.pipe(res), res);
      }).catch(err => console.log(err));
    }, function() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, JSON.stringify(modified));
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url, modifyResponse, onResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        onResponse(response) {
          response.headers.test = 'test';
        },
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = MODIFIED;
        }
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url, onResponse, modifyResponse}).then(request => request.pipe(res))', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        onResponse(response) {
          response.headers.test = 'test';
        },
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.upstream.successText));
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = MODIFIED;
        }
      })
        .then(response => response.pipe(res));
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.headers['content-length'], MODIFIED.length);
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('response content type is text/html and long content', function (done) {
    const MODIFIED = 'modified';
    const serverConfig = {
      contentType: 'text/html',
      successText: '<!DOCTYPE html> success' + (new Array(10000)).fill('a').join(''),
      failText: '<!DOCTYPE html> fail'
    };
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        modifyResponse(response) {
          assert.equal(typeof response.body, 'string');
          assert.equal(response.body, ctx.upstream.successText);
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = MODIFIED;
        }
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        done()
      });
    }, serverConfig);
  });

  it('response content type is image/png', function (done) {
    const MODIFIED = 'modified';
    const serverConfig = {
      contentType: 'image/png',
      successText: new Buffer('123')
    };
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        modifyResponse(response) {
          assert.ok(response.body.equals(ctx.upstream.successText), 'instanceof Buffer and equal');
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.statusMessage = 'TEST';
          response.body = MODIFIED;
        }
      }, res)
        .catch(err => console.log(err))
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(res.statusMessage, 'TEST');
        assert.equal(body, MODIFIED);
        done()
      });
    }, serverConfig);
  });

  it('modify response body to null, undefined', function (done) {
    const serverConfig = {
      contentType: 'image/png',
      successText: new Buffer('123')
    };
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${ctx.upstream.port}`,
        modifyResponse(response) {
          assert.ok(response.body.equals(ctx.upstream.successText), 'instanceof Buffer and equal');
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = null;
        }
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, '');
        done()
      });
    }, serverConfig);
  });

  it('response content type is excel will not stringify buffer', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        modifyResponse(response) {
          assert.ok(response.body instanceof Buffer);
        }
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    }, 'createMockFileServer');
  });
});
