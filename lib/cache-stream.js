const {Duplex} = require('stream');


function CacheState(options = {}) {
  // some situation may not need cache data, like big data upload download
  this.cacheActive = options.cacheActive !== false;
  this.chunks = [];
  this.dataLength = null;
  this.initReading();
}

CacheState.prototype.initReading = function initReading() {
  this.readingIndex = 0;
}


class CacheStream extends Duplex {
  constructor(options) {
    super(options);
    this._options = options;
    this._cacheState = new CacheState(options);
    this.once('finish', () => {
      const cState = this._cacheState;
      cState.dataLength = cState.chunks.length;
      if (this.isPaused()) this.resume();
    });
  }

  resetReadable() {
    if (this.reading) {
      throw new Error('can not reset readable stream while reading');
    }
    if (!this._cacheState.cacheActive) {
      throw new Error('cache function was truned off');
    }
    Duplex.call(this, this._options);
    this._cacheState.initReading();
  }

  _read() {
    const cState = this._cacheState;
    const {cacheActive, chunks} = cState;
    const writing = cState.dataLength === null;

    if (hasData()) {
      let chunk;
      while ( (chunk = getChunk()) ) {
        this.push(chunk.chunk, chunk.encoding);
        cState.readingIndex++;
      }
    }

    if (isExausted()) {
      this.push(null);
    } else {
      // allow resume to read data again. see _stream_readable.js line:337
      this._readableState.reading = false;
      this.pause();
    }


    function getChunk() {
      return cacheActive ? chunks[cState.readingIndex] : chunks.shift();
    }

    function hasData() {
      return cacheActive ? cState.readingIndex < chunks.length : !!chunks.length;
    }

    function isExausted() {
      return !writing && cState.readingIndex >= cState.dataLength;
    }
  }

  _write(chunk, encoding, callback) {
    if (chunk !== null && chunk !== undefined) {
      this._cacheState.chunks.push({chunk, encoding});
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


module.exports = CacheStream;
