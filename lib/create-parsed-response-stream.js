const CacheStream = require('./cache-stream');
const { copyResponseMeta } = require('./post-response');

function createParsedResponseStream(response, isCache) {
  let data = response.body || '';

  const needJSONStringify = data
    && typeof data === 'object'
    && !(data instanceof Buffer);

  data = needJSONStringify ? Buffer.from(JSON.stringify(data)) : data;

  const stream = new CacheStream({cacheActive: isCache});
  copyResponseMeta(response, stream);
  stream.body = response.body;
  stream.response = response;

  stream.headers['content-length'] = data.length;
  delete stream.headers['transfer-encoding'];

  // will trigger 'finish' event
  stream.end(data);
  return stream;
}

module.exports = createParsedResponseStream;
