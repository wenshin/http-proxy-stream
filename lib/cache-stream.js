const {Duplex} = require('stream');


function CacheState(options = {}) {
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
    // some situation may not need cache data, like big data upload download
    this.once('finish', () => {
      const cState = this._cacheState;
      cState.dataLength = cState.chunks.length;
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

  _read(size) {
    const cState = this._cacheState;
    const {cacheActive, dataLength, chunks} = cState;
    if (dataLength !== null) {
      if (chunks.length) {
        let chunk = getChunk();
        while (chunk && this.push(chunk.chunk, chunk.encoding)) {
          if (!cacheActive) chunks.shift();
          cState.readingIndex++;
          chunk = getChunk();
        }
      }
      if (dataLength === 0 || cState.readingIndex >= dataLength) {
        this.push(null);
      }
    }

    function getChunk() {
      return cacheActive ? chunks[cState.readingIndex] : chunks[0];
    }
  }

  _write(chunk, encoding, callback) {
    if (chunk !== null && chunk !== undefined) {
      this._cacheState.chunks.push({chunk, encoding});
    }
    callback();
  }

  _writev(chunks, callback) {
    this._cacheState.chunks = chunks;
    callback();
  }
}


module.exports = CacheStream;
