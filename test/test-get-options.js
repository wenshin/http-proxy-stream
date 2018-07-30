const assert = require('assert');
const getOptions = require(`../${process.env.TEST_DIR || 'lib'}/get-options`);

const mockReq = {
  headers: {},
  connection: {},
  pipe() {
  }
};

describe('get-options', () => {
  it('shoud not set default port for https', () => {
    const opt = getOptions(mockReq, {
      url: 'https://www.google.com'
    });
    assert.ok(!opt.port);
  });

  it('shoud not set default port for http', () => {
    const opt = getOptions(mockReq, {
      url: 'http://www.google.com'
    });
    assert.ok(!opt.port);
  });

  it('shoud keep host for ip url', () => {
    const opt = getOptions(mockReq, {
      url: 'http://127.0.0.1:8080/path/to',
      headers: {
        host: 'www.google.com'
      }
    });
    assert.equal(opt.requestOptions.headers.host, 'www.google.com');
  });
});
