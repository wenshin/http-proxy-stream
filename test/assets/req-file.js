const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/vnd.ms-excel',
    'Content-Disposition': 'attachment; filename="ok.xlsx"'
  })
  fs.readFile('./test.xlsx', function(err, data) {
    console.log(data);
    res.end(data);
  });
}).listen(8000);
