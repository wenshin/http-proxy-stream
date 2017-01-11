module.exports = ProxyRequestError;

function ProxyRequestError(message, error) {
  this.name = 'ProxyRequestError';
  this.message = message;
  this.stack = (new Error('ProxyRequestError stack')).stack;
  if (error) {
    this.stack = this.stack + '\n' + error.stack;
  }
}

ProxyRequestError.prototype = Object.create(Error.prototype);
ProxyRequestError.prototype.constructor = ProxyRequestError;
