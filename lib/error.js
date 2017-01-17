module.exports = ProxyRequestError;

function ProxyRequestError(message, error) {
  this.message = message;
  this.stack = error
    ? `ProxyRequestError: ${message}`+ '\n' + error.stack
    : (new Error(message)).stack;
}

ProxyRequestError.prototype = Object.create(Error.prototype);
ProxyRequestError.prototype.constructor = ProxyRequestError;
