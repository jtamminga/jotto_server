import { container } from 'tsyringe'
import { LobbyManager } from '../lobbyManager'
import { Logger } from '../logger'
import MemorySessionStore from '../memorySessionStore'
import { JottoSocket, NextFn } from '../types'

export function hostMiddleware(socket: JottoSocket, next: NextFn): void {
  const log = new Logger('middleware')

  // dependencies
  const sessionStore = container.resolve(MemorySessionStore)
  const lobbyManager = container.resolve(LobbyManager)

  const session = sessionStore.findSession(socket.data.sessionId!)

  // if there already is a session then we stop here
  if (session) {
    return next()
  }

  if (socket.data.host) {
    const lobby = lobbyManager.create(false)
    socket.data.lobbyCode = lobby.code
    log.info(`created lobby ${lobby.code}`)
  }

  return next()
}