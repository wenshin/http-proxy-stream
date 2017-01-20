/**
 * Copy from request library
 */

module.exports = onSocket;
function onSocket(req, socket, timeout) {
  var setReqTimeout = function() {
    // This timeout sets the amount of time to wait *between* bytes sent
    // from the server once connected.
    //
    // In particular, it's useful for erroring if the server fails to send
    // data halfway through streaming a response.
    req.setTimeout(timeout, function () {
      req.abort()
      var e = new Error('ESOCKETTIMEDOUT')
      e.code = 'ESOCKETTIMEDOUT'
      e.connect = false
      req.emit('error', e)
    })
  }
  // `._connecting` was the old property which was made public in node v6.1.0
  var isConnecting = socket._connecting || socket.connecting
  if (timeout !== undefined) {
    // Only start the connection timer if we're actually connecting a new
    // socket, otherwise if we're already connected (because this is a
    // keep-alive connection) do not bother. This is important since we won't
    // get a 'connect' event for an already connected socket.
    if (isConnecting) {
      var onReqSockConnect = function() {
        socket.removeListener('connect', onReqSockConnect)
        clearTimeout(req.timeoutTimer)
        req.timeoutTimer = null
        setReqTimeout()
      }

      socket.on('connect', onReqSockConnect)

      req.on('error', function() {
        socket.removeListener('connect', onReqSockConnect)
      })

      // Set a timeout in memory - this block will throw if the server takes more
      // than `timeout` to write the HTTP status and headers (corresponding to
      // the on('response') event on the client). NB: this measures wall-clock
      // time, not the time between bytes sent by the server.
      req.timeoutTimer = setTimeout(function () {
        socket.removeListener('connect', onReqSockConnect)
        req.abort()
        var e = new Error('ETIMEDOUT')
        e.code = 'ETIMEDOUT'
        e.connect = true
        req.emit('error', e)
      }, timeout)
    } else {
      // We're already connected
      setReqTimeout()
    }
  }
}
