const http = require('http');
const proxy = require('../../lib/');
const fs = require('fs');
const assert = require('assert');
const request = require('request');

const fileBuffer = fs.readFileSync('./test.xlsx');

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
  proxy(req, {
    url: 'http://localhost:8000',
    modifyResponse(response) {
      const file = fs.readFileSync('./test.xlsx');
      console.log('isEqual', file == response.body);
    }
  }, res);
}).listen(8001);
