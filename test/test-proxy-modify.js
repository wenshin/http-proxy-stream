const assert = require('assert');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);

describe('proxy-request-modify', function () {
  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.s.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = MODIFIED;
        }
      }, res);
    }, function() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url, modifyResponse}).then(request => request.pipe(res))', function (done) {
    const modified = {a: 1};
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.s.successText));
          response.statusCode = 206;
          response.headers.test = 'test';
          response.body = modified;
        }
      }).then(request => request.pipe(res));
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
        url: `http://localhost:${this.address().port}`,
        onResponse(response) {
          response.headers.test = 'test';
        },
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.s.successText));
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
        url: `http://localhost:${this.address().port}`,
        onResponse(response) {
          response.headers.test = 'test';
        },
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.s.successText));
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = MODIFIED;
        }
      })
        .then(request => request.pipe(res));
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
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.equal(typeof response.body, 'string');
          assert.equal(response.body, ctx.s.successText);
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
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.ok(response.body.equals(ctx.s.successText), 'instanceof Buffer and equal');
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

  it('modify response body to null, undefined', function (done) {
    const serverConfig = {
      contentType: 'image/png',
      successText: new Buffer('123')
    };
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.ok(response.body.equals(ctx.s.successText), 'instanceof Buffer and equal');
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
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.ok(response.body instanceof Buffer);
        }
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        done()
      });
    }, 'createMockFileServer');
  });
});
