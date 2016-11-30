const assert = require('assert');
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
});
