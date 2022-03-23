import 'reflect-metadata'
import 'colors'
import { v4 as randomId } from 'uuid'
import MemorySessionStore from './memorySessionStore'
import { Server } from 'socket.io'
import { GameState, GuessSubmission, JottoSocket } from './types'
import { filter } from 'rxjs'
import { GameEvents, UserEvents } from './events'
import { container } from 'tsyringe'
import { EventBus } from './eventBus'
import Lobby from './lobby'
import { ClientToServerEvents, ServerToClientEvents, SocketData, HostConfig, UserType, IllegalStateError, Session } from 'jotto_core'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'
import { createUser } from './utils'
import { initializeInjections } from './di'
import { TimerService } from './services'
import { LobbyManager } from './lobbyManager'


initializeInjections()

// event bus
const eventBus = container.resolve(EventBus)
const timerService = container.resolve(TimerService)
const lobbyManager = container.resolve(LobbyManager)

eventBus.events$
  .pipe(filter(GameEvents.isStateChangeEvent))
  .subscribe(onGameStateChange)

// 
const sessionStore = new MemorySessionStore()

const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>({
  cors: {
    origin: "*"
  }
})

// spin it up
timerService.start()
io.listen(3001)
console.log('server started'.cyan)

// middleware
io.use((socket, next) => {
  const sessionId = socket.handshake.auth.sessionId
  console.log( '[middleware]'.gray.bold, `sessionId: ${sessionId}`.gray)
  
  if (sessionId) {
    const session = sessionStore.findSession(sessionId)
    if (session) {
      console.log( '[middleware]'.gray.bold, 'session found')

      socket.data.sessionId = sessionId
      socket.data.userId = session.userId
      socket.data.lobbyCode = session.lobbyCode

      // check lobby
      const lobby = lobbyManager.find(session.lobbyCode)
      if (!lobby) {
        return next(new Error('lobby not found for this session'))
      }

      const user = lobby.find(session.userId)
      if (!user) {
        return next(new Error(`user not found in lobby ${lobby.code}`))
      }

      return next()
    }
  }

  const lobbyCode = socket.handshake.auth.lobbyCode

  socket.data.sessionId = randomId()
  socket.data.userId = randomId()
  socket.data.lobbyCode = lobbyCode

  if (lobbyCode === undefined) {
    next()
  } else {
    const lobby = lobbyManager.find(lobbyCode)
    if (lobby && lobby.room.isOpen) {
      next()
    } else {
      console.log('lobby not available'.bgRed)
      const error = new Error('lobby not available')
      next(error)
    }
  }
});

io.on('connection', (socket) => {
  // setup listeners on connected socket
  socket.on('disconnect', (reason) => userDisconnect(socket, reason))
  socket.on('joinRoom', (username, type) => joinRoom(socket, username, type))
  socket.on('startGame', (config) => startGame(socket, config))
  socket.on('submitWord', (word) => submitWord(socket, word))
  socket.on('submitGuess', (guess) => submitGuess(socket, guess))
  socket.on('rejoinRoom', () => rejoinRoom(socket))

  // connect user
  userConnect(socket);

  // socket.onAny((event) => {
  //   console.log(`[${event}]`.gray.bold, 'from'.gray, socket.data.username);
  // });

});

/**
 * Handles a connected user
 * @param socket The connected socket
 * @returns All the current user sessions
 */
function userConnect(socket: JottoSocket) {
  let session = sessionStore.findSession(socket.data.sessionId!)

  console.group('user connected'.green);
  console.log('username:  ', socket.data.username);
  console.log('sessionId: ', socket.data.sessionId);
  console.log('userId:    ', socket.data.userId);
  console.log('type:      ', socket.data.type);
  console.log('reconnect: ', !!session);
  console.groupEnd();

  if (session) {
    userReconnect(socket, session)
  } else {
    newUserConnect(socket)
  }
}

/**
 * Handle a new user connection
 * @param socket The socket that connected
 */
function newUserConnect(socket: JottoSocket) {
  const userLobbyCode = socket.data.lobbyCode
  let lobby: Lobby

  if (userLobbyCode) {
    const l = lobbyManager.find(userLobbyCode)
    if (!l) {
      throw new IllegalStateError('lobby not found')
    }
    console.log(`lobby ${l.code} found`)

    lobby = l
    socket.data.host = false
  } else {
    lobby = lobbyManager.create()
    socket.data.host = true
    socket.data.lobbyCode = lobby.code
    console.log(`lobby ${lobby.code} created`)
  }

  // send session details to connected user
  socket.emit('session', {
    sessionId: socket.data.sessionId!,
    userId: socket.data.userId!,
    lobbyCode: lobby.code
  });

  const session: Session = {
    userId: socket.data.userId!,
    lobbyCode: lobby.code
  }

  sessionStore.saveSession(socket.data.sessionId!, session)

  eventBus.publish(UserEvents.userConnected(socket.data.userId!, false))

  socket.join(lobby.code)
}

/**
 * Handle a reconnected user
 * @param socket The socket that reconnected
 * @param session The user's session
 */
function userReconnect(socket: JottoSocket, session: Session) {
  const lobby = getLobby(socket)
  const user = lobby.get(socket.data.userId!)

  socket.broadcast.emit('userConnect', user.userState())
  socket.emit('restore', lobby.userRestore(session.userId))
  eventBus.publish(UserEvents.userConnected(session.userId, true))
}

/**
 * Handle a user disconnected
 * @param socket The socket that disconnected
 */
function userDisconnect(socket: JottoSocket, reason: string) {
  const intended = reason === 'client namespace disconnect'

  console.group('user disconnected'.red);
  console.log('username: ', socket.data.username);
  console.log('sessionId:', socket.data.sessionId);
  console.log('userId:   ', socket.data.userId);
  console.log('intended: ', intended);
  console.groupEnd();

  // notify other users
  socket.broadcast.emit('userDisconnect', socket.data.userId!, intended)

  eventBus.publish(UserEvents.userDisconnected(socket.data.userId!, intended))

  if (intended) {
    sessionStore.removeSession(socket.data.sessionId!)
  }
}

function joinRoom(socket: JottoSocket, username: string, type: UserType) {
  const lobby = getLobby(socket)

  const user = createUser({
    userId: socket.data.userId!,
    username,
    type,
    host: socket.data.host!,
    lobbyCode: lobby.code
  })

  lobby.add(user)

  console.group('user joined lobby'.gray)
  console.log('lobby:     ', lobby.code)
  console.log('username:  ', user.username)
  console.log('userId:    ', user.userId)
  console.log('type:      ', user.type)
  console.log('host:      ', user.host)
  console.groupEnd();

  // broadcast to all others that a user connected
  socket.broadcast.to(lobby.code).emit('userConnect', user.userState())

  // send all connected users including the user just connected
  // to just the connected user
  // this allows the connected user to see any users that 
  // connected before
  const userStates = lobby.connected
    .map(p => p.userState())

  // send all connected users to the connected user
  socket.emit('users', userStates)
}

/**
 * Start the game
 */
function startGame(socket: JottoSocket, config: HostConfig) {
  const lobby = getLobby(socket)

  lobby.startGame(config)
  io.to(lobby.code).emit('wordPicking')

  console.group('game started'.cyan)
  console.log('in game:'.bold)
  lobby.game.players.forEach((p, i) =>
    console.log(`${i+1}) ${p.username}`))
  console.groupEnd()
}

/**
 * Handle a user submitting a word
 * @param socket The socket of the submitted word
 * @param word The word submitted
 */
function submitWord(socket: JottoSocket, word: string) {
  const lobby = getLobby(socket)
  const player = lobby.getPlayer(socket.data.userId!)

  console.group('word submitted'.magenta);
  console.log('user: ', player.username);
  console.log('word: ', word.bold);
  console.groupEnd();

  player.setWord(word)
  socket.broadcast.emit('userReady', socket.data.userId!);
}

/**
 * Handle a submit guess
 * @param socket The socket that submitted the guess
 * @param word The guess that was made
 */
function submitGuess(socket: JottoSocket, guess: GuessSubmission) {
  const lobby = getLobby(socket)
  const player = lobby.getPlayer(socket.data.userId!)

  const { common, won } = player.addGuess(guess)

  console.group('user guessed'.blue);
  console.log('from:  ', player.username);
  console.log('to:    ', player.opponent.username);
  console.log('word:  ', guess.word);
  console.log('common:', common);
  console.log('won:   ', won);
  console.groupEnd();

  io.to(lobby.code).emit('guessResult', {
    ...guess,
    common,
    won,
    date: new Date().getTime(),
    from: player.userId,
    to: player.opponent.userId
  });
}

/**
 * Handle user rejoining room after finishing game
 * @param socket The socket that submitted event
 */
function rejoinRoom(socket: JottoSocket) {
  const lobby = getLobby(socket)
  const player = lobby.getPlayer(socket.data.userId!)

  lobby.goBackToRoom(player.userId)

  console.group('joined room'.green)
  console.log('username:', player.username)
  console.groupEnd()

  // broadcast to all others that a user connected
  socket.broadcast.emit('userConnect', player.userState());

  // resend users when rejoining so user knows 
  // who is in the room already
  const users = lobby.room.all
    .map(player => player.userState())

  // also send over all observers
  const observers = lobby.observers
    .map(observer => observer.userState())

  // send to user all connected users
  socket.emit('users', [...users, ...observers])
}

function onGameStateChange(event: GameEvents.GameStateChangeEvent) {
  switch(event.game.state) {
    case GameState.playing:
      io.emit('startPlaying', event.game.config())

      console.group('opponents'.cyan)
      for(let player of event.game.players) {
        console.log(
          player.username.bold + ' against '.gray + player.opponent.username.bold 
        )
      }
      console.groupEnd()
      break

    case GameState.gameOver:
      console.log('game over'.cyan)
      io.emit('endGameSummary', event.game.summary())
      break

    case GameState.destroyed:
      console.log('game destroyed'.cyan)
  }
}

function getLobby(socket: JottoSocket): Lobby {
  const lobby = lobbyManager.find(socket.data.lobbyCode!)

  if (!lobby) {
    throw new IllegalStateError('user does not belong to lobby')
  }

  return lobby
}

