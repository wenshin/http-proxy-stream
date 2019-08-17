const assert = require('assert');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);

describe('proxy-request proxy redirect', function () {
  it('proxy(req, {url}, res) do not auto redirect by default', function (done) {
    utils.test(function(req, res) {
      proxy(req, {url: `http://localhost:${this.upstream.port}`}, res)
    }, function request() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 301);
        done()
      });
    }, 'createRedirectServer');
  });

  it('proxy(req, {url, autoSameOriginRedirect: true}, res)', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        autoSameOriginRedirect: true
      }, res)
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    }, 'createRedirectServer');
  });

  it('proxy(req, {url}).then(request => request.pipe(res))', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        autoSameOriginRedirect: true
      })
        .then(request => request.pipe(res));
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.upstream.successText);
        done()
      });
    }, 'createRedirectServer', {code: 302});
  });

  it('proxy(req, {url, autoSameOriginRedirect: true, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        autoSameOriginRedirect: true,
        onResponse(response) {
          response.headers['on-response'] = 'ok';
        },
        modifyResponse(response) {
          assert.equal(response.body, ctx.upstream.successText);
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
        assert.equal(res.headers['on-response'], 'ok');
        done()
      });
    }, 'createRedirectServer');
  });

  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.upstream.port}`,
        onResponse(response) {
          response.headers['on-response'] = 'ok';
        },
        modifyResponse(response) {
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
        assert.equal(res.headers['on-response'], 'ok');
        done()
      });
    }, 'createRedirectServer');
  });
});
