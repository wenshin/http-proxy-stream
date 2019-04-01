const {Duplex} = require('stream');


function CacheState(options = {}) {
  // some situation may not need cache data, like big data upload download
  this.cacheActive = options.cacheActive !== false;
  this.chunks = [];
  this.dataLength = null;
  this.cleared = false;
  this.initReading();
}

CacheState.prototype.initReading = function initReading() {
  this.readingIndex = 0;
}

CacheState.prototype.finish = function writing() {
  return this.dataLength = this.chunks.length;
}

CacheState.prototype.isWriting = function isWriting() {
  return this.dataLength === null;
}

CacheState.prototype.isExausted = function isExausted() {
  return !this.isWriting() && this.readingIndex >= this.chunks.length;
}

CacheState.prototype.getChunk = function getChunk() {
  const chunk = this.cacheActive ? this.chunks[this.readingIndex] : this.chunks.shift();
  if (this.cacheActive && chunk) {
    this.readingIndex++;
  }
  return chunk;
}

function handleStreamFinish(stream, cState) {
  cState.finish();
  // 继续传输没有传输的数据
  if (stream.isPaused()) stream.resume();
}

function readCacheState(stream, cState) {
  let chunk;
  while ( (chunk = cState.getChunk()) ) {
    // emit 'data' event
    stream.push(chunk.chunk, chunk.encoding);
  }

  if (cState.isExausted()) {
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
    this.once('finish', () => {
      handleStreamFinish(this, this._cacheState)
    });
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

  _read() {
    const cState = this._cacheState;
    readCacheState(this, cState);
  }

  _write(chunk, encoding, callback) {
    if (chunk !== null && chunk !== undefined) {
      this._cacheState.chunks.push({chunk, encoding});
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
CacheStream.handleStreamFinish = handleStreamFinish;

module.exports = CacheStream;
