const assert = require('assert');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);

describe('proxy-request error', function () {
  it('modifyResponse is not function throw error', function (done) {
    proxy({readable: true}, {modifyResponse: 1})
      .catch(err => {
        assert.ok(err instanceof Error);
        done();
      })
  });

  it('request.readable is false throw error', function (done) {
    proxy({readable: false})
      .catch(err => {
        assert.ok(err instanceof Error);
        done();
      })
  });

  it('promise reject when modifyResponse throw error', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        modifyResponse() {
          throw new Error('test');
        }
      }, res)
        .catch(err => {
          assert.ok(err instanceof proxy.ProxyRequestError);
          assert.equal(err.message, 'create new stream error');
          res.end('handle error');
        });
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function() {
        done();
      });
    });
  });

  it('promise reject when options.onResponse error', function (done) {
    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        onResponse(resp) {
          throw new Error('test response');
        },
        modifyResponse(res) {
          return res;
        }
      })
        .catch(err => {
          assert.ok(err instanceof proxy.ProxyRequestError);
          assert.equal(err.message, 'options.onResponse throw error');
          res.end('handle error');
        });
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function() {
        done();
      });
    });
  });
});
