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
  // 引用共享
  state.chunks = cState.chunks;
  state.readingFinished = cState.readingFinished;

  const stream =  new Readable({
    read() {
      CacheStream.readCacheState(this, state);
    }
  });

  if (!cState.readingFinished) {
    cacheStream.once('finish', () => {
      state.readingFinished = cState.readingFinished;
      if (stream.isPaused()) stream.resume();
    });
  }

  copyResponseMeta(cacheStream, stream);
  hackResponsePipe(stream);
  return stream;
}

module.exports = retrieveResponseStream;
