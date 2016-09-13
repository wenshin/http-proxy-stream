const assert = require('assert');
const utils = require('./utils');
const proxy = require('../lib');

describe('proxy-request', function () {
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

  it('proxy(req, {url, modifyResponse}, res).then(request => request.on("response", fn))', function (done) {
    const MODIFIED = 'modified';
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
          assert.deepEqual(response.body, JSON.parse(ctx.s.successText));
          assert.equal(res.statusCode, 200);
          response.statusCode = 206;
          response.body = MODIFIED;
        }
      }, res)
        .then(request => {
          request.on('response', (response) => {
            response.headers.test = 'test';
          });
        });
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

  it('response content type is text/html', function (done) {
    const MODIFIED = 'modified';
    const serverConfig = {
      contentType: 'text/html; charset=utf8',
      successText: '<!DOCTYPE html> success',
      failText: '<!DOCTYPE html> fail'
    };
    utils.test(function(req, res) {
      const ctx = this;
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse(response) {
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
});
