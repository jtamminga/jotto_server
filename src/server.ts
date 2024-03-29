import 'reflect-metadata'
import 'colors'
import MemorySessionStore from './memorySessionStore'
import { Server } from 'socket.io'
import { GameState, GuessSubmission, JottoSocket } from './types'
import { filter } from 'rxjs'
import { GameEvents, LobbyEvents, PlayerEvents, UserEvents } from './events'
import { container } from 'tsyringe'
import { EventBus } from './eventBus'
import Lobby from './lobby'
import { ClientToServerEvents, ServerToClientEvents, SocketData, HostConfig, UserType, IllegalStateError, Session } from 'jotto_core'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'
import { createUser } from './utils'
import { initializeInjections } from './di'
import { TimerService } from './services'
import { LobbyManager } from './lobbyManager'
import { hostMiddleware, sessionMiddleware } from './middleware'


initializeInjections()


const eventBus = container.resolve(EventBus)
const timerService = container.resolve(TimerService)
const lobbyManager = container.resolve(LobbyManager)
const sessionStore = container.resolve(MemorySessionStore)


eventBus.events$
  .pipe(filter(GameEvents.isStateChangeEvent))
  .subscribe(onGameStateChange)

eventBus.events$
  .pipe(filter(LobbyEvents.isLobbyDestroyedEvent))
  .subscribe(onLobbyDestroyed)

eventBus.events$
  .pipe(
    filter(PlayerEvents.isSetWordEvent),
    filter(e => e.assigned)
  )
  .subscribe(onAssignedWord)


//
// initialize server
// =================


const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>({
  cors: {
    origin: "*"
  }
})

// spin it up
timerService.start()
io.listen(3001)
console.log('server started'.cyan)


//
// setup middleware
// ================


io.use(sessionMiddleware)
io.use(hostMiddleware)


//
// on connection
// =============


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


//
// user connection
// ===============


/**
 * Handles a connected user
 * @param socket The connected socket
 * @returns All the current user sessions
 */
function userConnect(socket: JottoSocket) {
  const session = sessionStore.findSession(socket.data.sessionId!)

  console.group('user connected'.green)
  console.log('socketid:  ', socket.id)
  console.log('username:  ', socket.data.username)
  console.log('sessionId: ', socket.data.sessionId)
  console.log('userId:    ', socket.data.userId)
  console.log('host:      ', socket.data.host)
  console.log('type:      ', socket.data.type)
  console.log('reconnect: ', !!session)
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
  const lobby = getLobby(socket)

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
  socket.join(lobby.code)
  eventBus.publish(UserEvents.userConnected(socket.data.userId!, false))
}

/**
 * Handle a reconnected user
 * @param socket The socket that reconnected
 * @param session The user's session
 */
function userReconnect(socket: JottoSocket, session: Session) {
  const lobby = getLobby(socket)
  const user = lobby.getUser(socket.data.userId!)
  user.connected = true

  socket.join(lobby.code)
  socket.to(lobby.code).emit('userConnect', user.userState(), true)
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
  console.log('socketid: ', socket.id)
  console.log('username: ', socket.data.username);
  console.log('sessionId:', socket.data.sessionId);
  console.log('userId:   ', socket.data.userId);
  console.log('intended: ', intended);
  console.groupEnd();

  // notify others in lobby
  const lobby = lobbyManager.find(socket.data.lobbyCode!)
  if (lobby) {
    const user = lobby.findUser(socket.data.userId!)
    // the user could not exist in a lobby if a user joined a lobby
    // but disconnected before putting in a name
    if (user) {
      user.connected = false
      socket.to(lobby.code).emit('userDisconnect', socket.data.userId!, intended)
    }
  }

  eventBus.publish(UserEvents.userDisconnected(socket.data.userId!, intended))

  if (intended) {
    sessionStore.removeSession(socket.data.sessionId!)
  }
}


//
// socket events
// =============


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
  socket.to(lobby.code).emit('userConnect', user.userState(), false)

  // send all connected users including the user just connected
  // to just the connected user
  // this allows the connected user to see any users that 
  // connected before
  const userStates = lobby.getUsersFor(user)
    .map(p => p.userState())

  // send all connected users to the connected user
  socket.emit('users', userStates)
}

/**
 * Start the game
 */
function startGame(socket: JottoSocket, hostConfig: HostConfig) {
  const lobby = getLobby(socket)

  const game = lobby.startGame(hostConfig)
  io.to(lobby.code).emit('wordPicking', game.config())

  // log who is all in the game
  console.group('game started'.cyan)
  console.log('in game:'.bold)
  game.all.forEach((p, i) =>
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
  socket.to(lobby.code).emit('userReady', socket.data.userId!)
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
  socket.to(lobby.code).emit('userConnect', player.userState(), false);

  // resend users when rejoining so user knows 
  // who is in the room already
  const users = lobby.getUsersFor(player)
    .map(user => user.userState())

  // send to user all connected users
  socket.emit('users', users)
}


//
// bus handlers
// ============


function onAssignedWord(event: PlayerEvents.SetWordEvent) {
  for (let [_, socket] of io.sockets.sockets) {
    if (socket.data.userId === event.player.userId) {
      const lobby = getLobby(socket)
      socket.emit('assignedWord', event.word)
      socket.to(lobby.code).emit('userReady', event.player.userId)

      console.group('word assigned'.magenta);
      console.log('user: ', event.player.username);
      console.log('word: ', event.word.bold);
      console.groupEnd();
      break
    }
  }
}

function onGameStateChange(event: GameEvents.GameStateChangeEvent) {
  const lobby = lobbyManager.all.find(lobby => lobby.game === event.game)

  if (!lobby) {
    throw new IllegalStateError('lobby does not exist')
  }

  switch(event.game.state) {
    case GameState.playing:
      io.sockets.in(lobby.code).emit('startPlaying')

      console.group('opponents'.cyan)
      for(let player of event.game.all) {
        console.log(
          player.username.bold + ' against '.gray + player.opponent.username.bold 
        )
      }
      console.groupEnd()
      break

    case GameState.gameOver:
      console.log('game over'.cyan)
      io.sockets.in(lobby.code).emit('endGameSummary', event.game.summary())
      break

    case GameState.destroyed:
      console.log('game destroyed'.cyan)
  }
}

function onLobbyDestroyed(event: LobbyEvents.LobbyEvent) {
  io.sockets.in(event.lobby.code).disconnectSockets()
}

function getLobby(socket: JottoSocket): Lobby {
  const lobby = lobbyManager.find(socket.data.lobbyCode!)

  if (!lobby) {
    throw new IllegalStateError(`user does not belong to lobby`)
  }

  return lobby
}

