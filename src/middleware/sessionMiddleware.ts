import { container } from 'tsyringe'
import { LobbyManager } from '../lobbyManager'
import MemorySessionStore from '../memorySessionStore'
import { JottoSocket, NextFn } from '../types'
import { v4 as randomId } from 'uuid'
import { Logger } from '../logger'

export function sessionMiddleware(socket: JottoSocket, next: NextFn): void {
  const log = new Logger('middleware')

  // dependencies
  const sessionStore = container.resolve(MemorySessionStore)
  const lobbyManager = container.resolve(LobbyManager)

  // get the session token from auth
  const sessionId = socket.handshake.auth.sessionId

  if (sessionId) {

    const session = sessionStore.findSession(sessionId)

    // make sure session exists
    if (!session) {
      log.error(`session ${sessionId} not found`)
      return next(new Error('session not found'))
    }

    // make sure the lobby exists
    const lobby = lobbyManager.find(session.lobbyCode)
    if (!lobby) {
      log.error('lobby not found for this session')
      return next(new Error('lobby not found for this session'))
    }

    // make sure the user exists in that lobby
    const user = lobby.find(session.userId)
    if (!user) {
      log.error(`user not found in lobby ${lobby.code}`)
      return next(new Error(`user not found in lobby ${lobby.code}`))
    }

    log.info(`session reconnected`)

    // set socket data
    socket.data.sessionId = sessionId
    socket.data.userId = session.userId
    socket.data.lobbyCode = session.lobbyCode
    socket.data.username = user.username
    socket.data.host = user.host
    socket.data.type = user.type
    
    return next()
  }

  
  //
  // new user path
  // =============


  const lobbyCode = socket.handshake.auth.lobbyCode

  socket.data.sessionId = randomId()
  socket.data.userId = randomId()

  if (lobbyCode === undefined) {
    socket.data.host = true
    return next() // host
  }

  const lobby = lobbyManager.find(lobbyCode)
  if (!lobby || !lobby.room.isOpen) {
    log.error('lobby not available')
    return next(new Error('lobby not available'))
  }

  socket.data.host = false
  socket.data.lobbyCode = lobbyCode

  return next()

}