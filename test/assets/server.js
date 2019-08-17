const http = require('http');

http.createServer((req, res) => {
  console.log('server response')
  res.on('close', () => {
    console.log('server close')
  })
  res.on('finish', () => {
    console.log('server finish')
  })
  // 如果没有指定 content-length，采用 Chunked Transfer 的方式传输
  const body = (new Array(100)).fill('(function() { window.aaaa = 1 })();').join('');
  res.writeHead(200, {
    // 'Content-length': '1000',
    'access-control-allow-origin': '*',
    'cache-control': 'max-age=100000000',
    'content-type': 'application/javascript',
    // 文本长度到了，会自动结束请求，但是不会触发 finish 事件
    // 'content-length': body.length * 1000,
  });
  // setTimeout(() => {
  //   res.write(body);
  //   console.log('end')
  //   res.end();
  // }, 5000);

  let count = 0;
  const timer = setInterval(() => {
    count++;
    if (count < 30) {
      console.log('response', count)
      res.write(body);
    } else {
      clearInterval(timer);
      // 如果是 Chunked Transfer，默认
      console.log('server response end called')
      res.end(body);
    }
  }, 300);
}).listen(8001);
