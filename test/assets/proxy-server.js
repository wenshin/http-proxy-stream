const http = require('http');
const proxy = require('../../lib');
const fs = require('fs');
const assert = require('assert');
// const request = require('request');

http.createServer((req, res) => {
  console.log('proxy server response')
  req.on('abort', () => {
    console.log('proxy server client abort')
  })
  res.on('close', () => {
    console.log('proxy server close')
  })
  res.on('error', () => {
    console.log('proxy server error')
  })
  res.on('finish', () => {
    console.log('proxy server finish')
  })
  // request.get('http://localhost:8001', {encoding: null}, function(err, response, body) {
  //   res.setHeader('Content-Type', 'application/vnd.ms-excel');
  //   res.setHeader('Content-Disposition', 'attachment; filename="ok.xlsx"');
  //   res.statusCode = 200;
  //   // res.end(body)
  //   console.log('parsed', Buffer.from(body))
  //   res.write(body);
  //   res.end()
  // });
  proxy(req, {
    url: 'http://localhost:8001',
    cache: true,
    // onResponse(resp) {
    //   throw new Error('test')
    // }
  })
    .then(proxyRes => {
      console.log('proxy response')
      proxyRes.on('error', err => {
        console.log('proxy response error', err)
        res.end(err.stack);
      });
      proxyRes.pipe(res)
    })
    .catch(err => {
      console.log('catch error', err)
    })
  // const areq = http.request({
  //   hostname: 'www.google.com',
  //   headers: Object.assign(req.headers, {host: null, connection: null})
  // });
  // areq.on('response', resp => {
  //   res.statusCode = resp.statusCode;
  //   res.statusMessage = resp.statusMessage;
  //   res.headers = resp.headers;
  //   resp.pipe(res);
  // })
  // areq.setTimeout(100000, () => {
  //   areq.abort();
  // })
  // areq.on('error', (err) => console.log(err))
  // req.pipe(areq);
})
  .listen(8002);
