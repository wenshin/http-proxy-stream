module.exports = ProxyRequestError;

function ProxyRequestError(message, error) {
  this.name = 'ProxyRequestError';
  this.message = message;
  this.stack = (new Error(message)).stack;
}

ProxyRequestError.prototype = Object.create(Error.prototype);
ProxyRequestError.prototype.constructor = ProxyRequestError;
