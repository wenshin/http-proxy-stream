const assert = require('assert');
const utils = require('./utils');
const proxy = require('../lib');

describe('proxy-request', function () {
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
      proxy(req, {url: `http://localhost:${this.address().port}`})
        .then(request => request.pipe(res));
    }, function() {
      const ctx = this;
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 200);
        assert.equal(body, ctx.s.successText);
        done()
      });
    });
  });

  it('proxy(req, {url, modifyResponse}, res)', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(body) {
          assert.equal(body, ctx.s.successText);
          this.response.statusCode = 206;
          this.response.headers.test = 'test';
          return MODIFIED;
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
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(body) {
          assert.equal(body, ctx.s.successText);
          this.response.statusCode = 206;
          this.response.headers.test = 'test';
          return MODIFIED;
        }
      }).then(request => request.pipe(res));
    }, function() {
      utils.get.call(this, null, function(res, body) {
        assert.equal(res.statusCode, 206);
        assert.equal(body, MODIFIED);
        assert.equal(res.headers.test, 'test');
        done()
      });
    });
  });

  it('proxy(req, {url}, res).then(request => request.on("response", fn))', function (done) {
    utils.test(function(req, res) {
      proxy(req, {url: `http://localhost:${this.address().port}`}, res)
        .then(request => {
          request.on('response', (response) => {
            response.headers.test = 'test';
          });
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
