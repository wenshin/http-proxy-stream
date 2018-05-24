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
      url: 'https://www.baidu.com'
    });
    assert.ok(!opt.port);
  });

  it('shoud not set default port for http', () => {
    const opt = getOptions(mockReq, {
      url: 'http://www.baidu.com'
    });
    assert.ok(!opt.port);
  });
});
