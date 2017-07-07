const http = require('http')
const uuid = require('uuid')
const WebSocket = require('ws')

const server = http.createServer()

const port = process.env.PORT || 3834

const sock = new WebSocket.Server({server})

server.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

const socketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}

// keep track of connections
const sockets = {}

sock.on('connection', onConnection)

function send(socket, eventName, data) {
  socket.send(JSON.stringify({eventName, data}))
}

function removeSocket(socket) {
  sockets[socket] = undefined
  delete sockets[socket]
}

function sendConnectionIds() {
  for (var id in sockets) {
    var socket = sockets[id]
    var socketIds = Object.keys(sockets).filter(sId => (sId !== socket.id))

    if (socket.readyState === socketState.CLOSED || socket.readyState === socketState.CLOSING) {
      removeSocket(socket)
      return false
    }

    socket.send(JSON.stringify({eventName: 'connections', data: socketIds}))
  }
}

function onConnection(socket) {
  // generate a unique id
  if (!socket.id) {
    const id = uuid.v4()
    socket.id = id
  }

  sockets[socket.id] = socket

  // we have a unique identifier that can be sent to the client
  send(socket, 'socket_id', socket.id)

  sendConnectionIds(socket)

  // remove references to the disconnected socket
  socket.on('disconnect', () => {
    removeSocket(socket)
  })

  // forward message to the addressee
  socket.on('message', (message) => {
    handleMessage(socket, message)
  })
}

function handleMessage(socket, message) {
  try {
    message = JSON.parse(message)
  } catch(error) {
    console.error(error)
    return false
  }

  const {eventName, data}  = message

  if (eventName === 'logon') {
    logon(socket, data)
    return false
  } else if (eventName === 'logoff') {
    logoff(socket, data)
    return false
  }

  if (sockets[data.to]) {
    send(sockets[data.to], 'message', data)
  } else {
    send(socket, 'disconnected', data.from)
  }
}

// when a listener logs on let the media streaming know about it
function logon(socket, message) {
  if (sockets[message.to]) {
    send(sockets[message.to], 'logon', message)
  } else {
    send(socket, 'error', 'Does not exsist on server.')
  }
}

function logoff(socket, message) {
  if (sockets[message.to]) {
    send(sockets[message.to], 'logoff', message)
  } else {
    send(socket, 'error', 'Does not exsist on server.')
  }
}
