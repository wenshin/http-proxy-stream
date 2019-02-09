const assert = require('assert');
const stream = require('stream');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);

class TestWritableStream extends stream.Writable {
  _write(chunk, encoding, callback) {
    this.chunks = this.chunks || [];
    this.chunks.push({chunk, encoding});
    callback();
  }
}

describe('retrieveResponseStream', () => {
  it('retrieveResponseStream without data', function (done) {
    const cStream = new proxy.CacheStream();
    cStream.headers = {
      'x-test': 'test'
    };
    cStream.end(null);
    const res = proxy.retrieveResponseStream(cStream);
    const ws = new TestWritableStream();
    res.pipe(ws);
    ws.on('finish', () => {
      assert.ok(!ws.chunks);
      assert.deepEqual(ws.headers, cStream.headers);
      done();
    });
  });

  it('retrieveResponseStream with data', function (done) {
    const cStream = new proxy.CacheStream();
    const ws = new TestWritableStream();
    cStream.headers = {
      'x-test': 'test'
    };
    ws.headers = {
      'x-test-ws': 'test'
    };
    cStream.write('中文 ');
    cStream.end('end');
    const res = proxy.retrieveResponseStream(cStream);
    res.pipe(ws);
    ws.on('finish', () => {
      assert.equal(ws.chunks.length, 2);
      assert.deepEqual(ws.headers, {
        'x-test': 'test',
        'x-test-ws': 'test'
      });
      done();
    });
  });
});
