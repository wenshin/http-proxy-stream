const assert = require('assert');
const utils = require('./utils');
const stream = require('stream');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);


class TestWritableStream extends stream.Writable {
  _write(chunk, encoding, callback) {
    console.log(chunk, encoding);
    this._chunks = this._chunks || [];
    this._chunks.push({chunk, encoding});
    callback();
  }
}


describe('CacheStream', function () {
  it('CacheStream pipe multi times', function (done) {
    const cacheStream = new proxy.CacheStream();
    const ws = new TestWritableStream();
    const ws2 = new TestWritableStream();
    cacheStream.write('中文 ');
    cacheStream.end('end');
    cacheStream.pipe(ws);
    ws.on('finish', () => {
      cacheStream.resetReadable();
      cacheStream.pipe(ws2);
      ws2.on('finish', () => {
        done();
      })
    });
  });
});
