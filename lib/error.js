module.exports = ProxyRequestError;

function ProxyRequestError(message, error) {
  this.message = message;
  if (error) {
    this.stack = `ProxyRequestError: ${message}`+ '\n' + error.stack;
    error.code && (this.code = error.code);
    error.status && (this.status = error.status);
    error.statusCode && (this.statusCode = error.statusCode);
  } else {
    this.stack = (new Error(message)).stack;
  }
}

ProxyRequestError.prototype = Object.create(Error.prototype);
ProxyRequestError.prototype.constructor = ProxyRequestError;
