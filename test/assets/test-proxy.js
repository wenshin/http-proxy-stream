const http = require('http');
const proxy = require('../../lib/');
const fs = require('fs');
const assert = require('assert');
const request = require('request');

const file = fs.readFileSync('./test.xlsx');

http.createServer((req, res) => {
  // request.get('http://localhost:8000', {encoding: null}, function(err, response, body) {
  //   res.setHeader('Content-Type', 'application/vnd.ms-excel');
  //   res.setHeader('Content-Disposition', 'attachment; filename="ok.xlsx"');
  //   res.statusCode = 200;
  //   // res.end(body)
  //   console.log('parsed', Buffer.from(body))
  //   res.write(body);
  //   res.end('0\r\n\r\n')
  // });
  // proxy(req, {
  //   url: 'http://localhost:8000',
  //   onResponse(resp) {
  //     throw new Error('test')
  //   }
  // })
  //   .then(request => {
  //     request.on('error', err => {
  //       res.end(err.stack);
  //     });
  //     request.pipe(res)
  //   })
  //   .catch(err => console.log('catch error'))
  const areq = http.request({
    hostname: 'www.google.com',
    headers: Object.assign(req.headers, {host: null, connection: null})
  });
  areq.on('response', resp => {
    res.statusCode = resp.statusCode;
    res.statusMessage = resp.statusMessage;
    res.headers = resp.headers;
    resp.pipe(res);
  })
  areq.setTimeout(100000, () => {
    areq.abort();
  })
  areq.on('error', (err) => console.log(err))
  req.pipe(areq);
})
  .listen(8002);
