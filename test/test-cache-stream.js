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

const CHUNK_COUNT = 10;

class TestSyncReableStream extends stream.Readable {
  _read() {
    let count = 0;
    while (count < CHUNK_COUNT) {
      this.push(count + ',');
      count++;
    }
    this.push(null);
  }
}

class TestAsyncReableStream extends stream.Readable {
  _read() {
    this._count = this._count || 0;
    // console.log('upstream push start')
    const timer = setInterval(() => {
      if (this._count >= CHUNK_COUNT) {
        clearInterval(timer);
        this.push(null);
      } else {
        // console.log('upstream push', this._count)
        this.push(this._count + ',');
        this._count++;
      }
    }, 5);
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

  it('CacheStream pipe from sync readable stream and sync pipe to writable stream', function (done) {
    const cStream = new proxy.CacheStream();
    const rs = new TestSyncReableStream();
    const ws = new TestWritableStream();
    rs.pipe(cStream).pipe(ws);
    ws.on('finish', () => {
      assert.equal(ws.chunks.length, CHUNK_COUNT);
      done();
    });
  });

  it('CacheStream pipe from sync readable stream and async pipe to writable stream', function (done) {
    const cStream = new proxy.CacheStream();
    const rs = new TestSyncReableStream();
    const ws = new TestWritableStream();
    rs.pipe(cStream);
    setTimeout(() => {
      cStream.pipe(ws);
      ws.on('finish', () => {
        assert.equal(ws.chunks.length, CHUNK_COUNT);
        done();
      });
    }, 10);
  });

  it('CacheStream pipe from async readable stream and sync pipe to writable stream', function (done) {
    const cStream = new proxy.CacheStream();
    const rs = new TestAsyncReableStream();
    const ws = new TestWritableStream();
    rs.pipe(cStream).pipe(ws);
    ws.on('finish', () => {
      assert.equal(ws.chunks.length, CHUNK_COUNT);
      done();
    });
  });

  it('CacheStream pipe from async readable stream and async pipe to writable stream', function (done) {
    const cStream = new proxy.CacheStream();
    const rs = new TestAsyncReableStream();
    const ws = new TestWritableStream();
    cStream.name = 'pipeReadable'
    rs.pipe(cStream);
    setTimeout(() => {
      cStream.pipe(ws);
      ws.on('finish', () => {
        assert.equal(ws.chunks.length, CHUNK_COUNT);
        done();
      });
    }, 10);
  });
});
