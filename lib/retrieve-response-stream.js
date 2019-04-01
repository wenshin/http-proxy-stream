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
  state.dataLength = cState.dataLength;

  const stream =  new Readable({
    read() {
      CacheStream.readCacheState(this, state);
    }
  });

  if (cState.isWriting()) {
    cacheStream.once('finish', () => {
      CacheStream.handleStreamFinish(stream, state);
    });
  }

  copyResponseMeta(cacheStream, stream);
  hackResponsePipe(stream);
  return stream;
}

module.exports = retrieveResponseStream;
