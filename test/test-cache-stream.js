const assert = require('assert');
const stream = require('stream');
const proxy = require(`../${process.env.TEST_DIR || 'lib'}`);
const { copyResponseMeta, hackResponsePipe } = require(`../${process.env.TEST_DIR || 'lib'}/post-response`);


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

function createMockAsyncResponse(headers = {}, status = 200) {
  const res = new TestAsyncReableStream();
  res.statusCode = status;
  res.headers = Object.assign({
    'content-length': 20
  }, headers);
  return res;
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

  it('CacheStream can not pipe again after call stream.clearCache()', function (done) {
    const cStream = new proxy.CacheStream();
    const ws = new TestWritableStream();
    cStream.end('end');
    cStream.pipe(ws);
    ws.on('finish', () => {
      assert.ok(!!cStream._cacheState.chunks.length);
      cStream.clearCache();
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
        assert.ok(cStream.isCacheValid())
        assert.equal(ws.chunks.length, CHUNK_COUNT);
        done();
      });
    }, 10);
  });

  it('CacheStream.isCacheValid() === true when upstream set content-length', function (done) {
    const cStream = new proxy.CacheStream();
    cStream.name = 'pipeReadable';

    const rs = createMockAsyncResponse();
    hackResponsePipe(rs);

    rs.pipe(cStream);
    cStream.on('finish', () => {
      assert.ok(cStream.isCacheValid());
      done();
    });
  });

  it('CacheStream.isCacheValid() === false upstream server abort', function (done) {
    const cStream = new proxy.CacheStream();
    cStream.name = 'pipeReadable';
    cStream.on('aborted', () => {
      assert.ok(!cStream.isCacheValid());
      done();
    });

    const rs = createMockAsyncResponse();
    hackResponsePipe(rs);

    rs.pipe(cStream);
    rs.emit('aborted');
  });

  it('CacheStream.isCacheValid() === false of content-length check fail', function (done) {
    const cStream = new proxy.CacheStream();
    cStream.name = 'pipeReadable';

    const rs = createMockAsyncResponse({
      'content-length': 10
    });
    hackResponsePipe(rs);

    rs.pipe(cStream);
    cStream.on('finish', () => {
      assert.ok(!cStream.isCacheValid())
      done();
    });
  });
});
