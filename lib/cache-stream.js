const {Duplex} = require('stream');
const lodash = require('lodash');
const { hackResponsePipe } = require('./post-response');


class CacheState {
  constructor(options = {}) {
    // some situation may not need cache data, like big data upload download
    this.cacheActive = options.cacheActive !== false;
    // chunked tranfer end chunk will not received
    this.chunks = [];
    this.destroyed = false;
    this.cleared = false;
    this.readingFinished = false;
    this.error = null;
    this.initReading();
  }

  initReading() {
    this.readingIndex = 0;
  }

  finishReading(stream) {
    this.readingFinished = true;
    // continue to send data not been sent
    if (stream.isPaused()) stream.resume();
  }

  getChunk() {
    const chunk = this.cacheActive ? this.chunks[this.readingIndex] : this.chunks.shift();
    if (this.cacheActive && chunk) {
      this.readingIndex++;
    }
    return chunk;
  }

  getDataLength() {
    return this.chunks.reduce((prev, cur) => lodash.get(cur, 'chunk.length', 0) + prev, 0);
  }
}

function readCacheState(stream, cState) {
  if (cState.destroyed) {
    return;
  }

  let chunk;
  while ( (chunk = cState.getChunk()) ) {
    // emit 'data' event
    stream.push(chunk.chunk, chunk.encoding);
  }

  if (cState.readingFinished) {
    stream.push(null);
  } else {
    // allow resume
    stream._readableState.reading = false;
    stream.pause();
  }
}

class CacheStream extends Duplex {
  constructor(options) {
    super(options);
    this._options = options;
    this._cacheState = new CacheState(options);

    // writable stream read from readable upstream
    this.once('finish', () => {
      this._cacheState.finishReading(this)
    });

    this.once('error', (err) => {
      this._cacheState.error = err;
    });

    hackResponsePipe(this);
  }

  isCacheValid() {
    const cState = this._cacheState;
    if (cState.destroyed || !cState.readingFinished) {
      return false;
    }
    if (this.srcHeaders && this.srcHeaders['content-length']) {
      return cState.getDataLength() === Number(this.srcHeaders['content-length'])
    }
    return true;
  }

  /**
   * make stream to readable again,
   * can not been used in concurrency, e.g. memory cache of some request and reused for many requests.
   * using retrieve-response-stream.js for instead in memory cache scene.
   */
  resetReadable() {
    if (this.reading) {
      throw new Error('can not reset readable stream while reading');
    }
    if (!this._cacheState.cacheActive) {
      throw new Error('cache function was turned off');
    }
    if (this._cacheState.cleared) {
      throw new Error('cache cleared');
    }
    this.removeAllStreamListeners();
    Duplex.call(this, this._options);
    this._cacheState.initReading();
  }

  removeAllStreamListeners() {
    this.removeAllListeners('end');
    this.removeAllListeners('close');
    this.removeAllListeners('finish');
    this.removeAllListeners('data');
    this.removeAllListeners('error');
    this.removeAllListeners('pipe');
    this.removeAllListeners('unpipe');
    this.removeAllListeners('drain');
  }

  clearCache() {
    this._cacheState.chunks = [];
    this._cacheState.cleared = true;
  }

  _destroy(err, cb) {
    this._cacheState.destroyed = true;
    cb(err);
  }

  _read() {
    const cState = this._cacheState;
    readCacheState(this, cState);
  }

  _write(chunk, encoding, callback) {
    if (chunk !== null && chunk !== undefined) {
      this._cacheState.chunks.push({chunk, encoding});
      // resume pipeline read data
      if (this.isPaused()) this.resume();
    }
    callback();
  }

  _writev(chunks, callback) {
    const noop = () => {};
    chunks.map(c => this._write(c.chunk, c.encoding, noop));
    callback();
  }
}

CacheStream.CacheState = CacheState;
CacheStream.readCacheState = readCacheState;

module.exports = CacheStream;
