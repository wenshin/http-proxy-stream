const assert = require('assert');
const utils = require('./utils');
const stream = require('stream');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);


class TestWritableStream extends stream.Writable {
  _write(chunk, encoding, callback) {
    this.chunks = this.chunks || [];
    this.chunks.push({chunk, encoding});
    callback();
  }
}


describe('CacheStream', function () {
  it('CacheStream pipe multi times', function (done) {
    const cStream = new proxy.CacheStream();
    const ws = new TestWritableStream();
    const ws2 = new TestWritableStream();
    cStream.write('中文 ');
    cStream.end('end');
    cStream.pipe(ws);
    ws.on('finish', () => {
      cStream.resetReadable();
      cStream.pipe(ws2);
      ws2.on('finish', () => {
        assert.equal(ws.chunks.length, 2);
        assert.equal(cStream._cacheState.chunks.length, 2);
        done();
      })
    });
  });

  it('CacheStream can not pipe again when options.cacheActive === false', function (done) {
    const cStream = new proxy.CacheStream({
      cacheActive: false
    });
    const ws = new TestWritableStream();
    const ws2 = new TestWritableStream();
    cStream.write('中文 ');
    cStream.end('end');
    cStream.pipe(ws);
    ws.on('finish', () => {
      assert.equal(ws.chunks.length, 2);
      assert.ok(!cStream._cacheState.chunks.length);
      assert.throws(() => cStream.resetReadable(), Error);
      done();
    });
  });
});
