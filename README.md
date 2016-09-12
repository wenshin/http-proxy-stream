# proxy-request

a proxy tool by request which damn convenient with stream pipe. inspired by [request](https://github.com/request/request)

## feature

* pipe http proxy
* modify response before pipe to destination stream

# Install

    npm i --save proxy-request

# API

## Method

### proxy(request, [options, response])

- **request**: `http.IncomingMessage` instance or other instance of request.
- **options**: `Object`,  all options of 'request' library but 'callback', the url option is need.
- **options.modifyResponse**: `Function(body)`, `Optional`, modify response before pipe to destination stream. accept one argument which is the body of response. the `this` keyword is reference of `request.Request` instance. the return value will be the new content of response.
- **response**: `Optional`, writable stream, like http.ServerResponse instance.

# Usage

### Normal Proxy

```javascript
const proxy = require('proxy');
const http = require('http');

// http useage
http.createServer((req, res) => {
  proxy(req, {url: `http://www.google.com${req.url}`}, res);
}).listen(8000);

// koa middleware
function* koaProxy(next) {
  const req = yield proxy(this.req, {url: `http://www.google.com${this.req.url}`});
  req.on('response', function(response) {
    this.headers = response.headers;
  });
  this.body = req;
}
```

### Modify Reponse Before Pipe

Some times we want modify the response of the backend services. you can define a function as `options.modifyResponse`.

```javascript
const proxy = require('proxy');
const http = require('http');

// http useage
http.createServer((req, res) => {
  proxy(req, {
    url: `http://www.google.com${req.url}`,
    modifyResponse(body) {
      // change headers
      this.reponse.headers['content-type'] = 'application/json; charset: utf8';
      // use new content, must be string or buffer;
      return JSON.stringify({content: body});
    }
  }, res);
}).listen(8000);
```

# Develop

    $> npm i
    $> npm test
    $> npm publish

# Release Note

v0.1.0 2016-09-12

    * first version
