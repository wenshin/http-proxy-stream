'use strict';

module.exports = ProxyRequestError;

function ProxyRequestError(message, error) {
  Error.call(this, message);
  this.name = 'ProxyRequestError';
  this.message = message;
  if (error) {
    this.stack = this.stack + '\n' + error.stack;
  }
}

ProxyRequestError.prototype.constructor = ProxyRequestError;
ProxyRequestError.prototype = new Error();