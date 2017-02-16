const assert = require('assert');
const utils = require('./utils');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);
const pr = require(`../${process.env.TEST_DIR || 'lib'}/post-response`);

const oldInitResponseProps = pr.initResponseProps;


describe('proxy-request error', function () {
  it('modifyResponse is not function throw error', function () {
    try {
      proxy({headers: {}, connection: {}}, {modifyResponse: 1})
    } catch (err) {
      assert.ok(err instanceof proxy.ProxyRequestError);
    }
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
          assert.ok(!!err.proxyInfo.headers);
          assert.ok(!!err.proxyInfo.resHeaders);
          assert.equal(err.proxyInfo.resStatus, 200);
          assert.deepEqual(err.proxyInfo.resBody, {success: true});
          assert.ok(err instanceof proxy.ProxyRequestError);
          assert.equal(err.message, 'proxy options.modifyResponse error');
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
        onResponse() {
          throw new Error('test response');
        }
      })
        .catch(err => {
          assert.ok(err instanceof proxy.ProxyRequestError);
          res.end('handle error');
        })
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function() {
        done();
      });
    });
  });

  it('catch _onResponse error', function (done) {
    pr.initResponseProps = function () {
      throw new Error('testabc');
    }

    utils.test(function(req, res) {
      proxy(req, {
        url: `http://localhost:${this.address().port}`,
        onResponse() {
          throw new Error('test response');
        }
      })
        .catch(err => {
          assert.ok(err instanceof proxy.ProxyRequestError);
          assert.ok(err.stack.indexOf('testabc') > -1);
          res.end('handle error');
        })
    }, function() {
      const ctx = this;
      utils.get.call(ctx, null, function() {
        pr.initResponseProps = oldInitResponseProps;
        done();
      });
    });
  });
});
