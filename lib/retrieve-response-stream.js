const assert = require('assert');
const {Readable} = require('stream');
const CacheStream = require('./cache-stream');
const {copyResponseMeta, hackResponsePipe} = require('./post-response');

/**
 * clone a new stream for the same data, should only use cache mode
 */
function retrieveResponseStream(cacheStream) {
  assert.ok(cacheStream._cacheState, 'retrieveResponseStream(cacheStream) cacheStream is not valid');

  const cState = cacheStream._cacheState;
  const state = new CacheStream.CacheState();
  state.chunks = cState.chunks;
  state.dataLength = cState.chunks ? cState.chunks.length : 0;
  const stream =  new Readable({
    read() {
      const {chunks} = state;

      if (hasData()) {
        let chunk;
        while ( (chunk = getChunk()) ) {
          this.push(chunk.chunk, chunk.encoding);
          state.readingIndex++;
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
        return chunks[state.readingIndex];
      }

      function hasData() {
        return state.readingIndex < chunks.length;
      }

      function isExausted() {
        return state.readingIndex >= state.dataLength;
      }
    }
  });
  copyResponseMeta(cacheStream, stream);
  hackResponsePipe(stream);
  return stream;
}

module.exports = retrieveResponseStream;
