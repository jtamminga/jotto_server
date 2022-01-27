import 'reflect-metadata'
import 'colors';
import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import { Server } from 'socket.io';
import { GameState, GuessSubmission, JottoSocket, PlayerState } from './types';
import { filter } from 'rxjs';
import { GameEvents, UserEvents } from './events';
import { container } from 'tsyringe';
import { EventBus } from './eventBus';
import Lobby from './lobby';
import { ClientToServerEvents, ServerToClientEvents, SocketData, Session } from 'jotto_core'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'
import { createUser } from './utils';

// event bus
const eventBus = container.resolve(EventBus)

eventBus.events$
  .pipe(filter(GameEvents.isStateChange))
  .subscribe(onGameStateChange);

const randomId = () => randomBytes(8).toString('hex');

// 
const lobby = new Lobby()
const sessionStore = new MemorySessionStore()

const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>({
  cors: {
    origin: "http://localhost:3000"
  }
});

// spin it up
io.listen(3001);
console.log('server started'.cyan)

// middleware
io.use((socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  
  if (sessionId) {
    const session = sessionStore.findSession(sessionId);
    if (session) {
      socket.data.sessionId = sessionId
      socket.data.userId = session.userId
      socket.data.username = session.username
      socket.data.type = session.type
      return next();
    }
  }

  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"));
  }
  socket.data.sessionId = randomId();
  socket.data.userId = randomId();
  socket.data.username = username;
  socket.data.type = socket.handshake.auth.type
  next();
});

io.on('connection', (socket) => {
  // setup listeners on connected socket
  socket.on('disconnect', (reason) => userDisconnect(socket, reason));
  socket.on('startGame', () => startGame());
  socket.on('submitWord', (word) => submitWord(socket, word));
  socket.on('submitGuess', (guess) => submitGuess(socket, guess));
  socket.on('rejoinRoom', () => rejoinRoom(socket));

  // connect user
  userConnect(socket);

  // socket.onAny((event) => {
  //   console.log(`[${event}]`.gray.bold, 'from'.gray, socket.username.gray.italic);
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
  // send session details to connected user
  socket.emit('session', {
    sessionId: socket.data.sessionId!,
    userId: socket.data.userId!
  });

  const session: Session = {
    userId: socket.data.userId!,
    username: socket.data.username!,
    type: socket.data.type!,
    connected: true
  }

  sessionStore.saveSession(socket.data.sessionId!, session)

  lobby.addUser(createUser(session))

  // broadcast to all others that a user connected
  socket.broadcast.emit('userConnect', session)
  
  eventBus.publish(UserEvents.userConnected(session.userId, false))

  // send all connected users including the user just connected
  // to just the connected user
  // this allows the connected user to see any users that 
  // connected before 
  sendUsers(socket)
}

/**
 * Handle a reconnected user
 * @param socket The socket that reconnected
 * @param session The user's session
 */
function userReconnect(socket: JottoSocket, session: Session) {
  socket.broadcast.emit('userConnect', session)
  eventBus.publish(UserEvents.userConnected(session.userId, true))
  socket.emit('restore', lobby.userRestore(session.userId))
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
  socket.broadcast.emit('userDisconnect', socket.data.userId!);

  eventBus.publish(UserEvents.userDisconnected(socket.data.userId!, intended))
}

/**
 * Send users to user including the user itself
 * @param socket The connected socket
 */
function sendUsers(socket: JottoSocket) {
  // TODO: send either playerstate or observer state
  const playerStates = lobby.connected
    .map(p => p.asSession())

  // send all connected users to the connected user
  socket.emit('users', playerStates)
}

/**
 * Start the game
 */
function startGame() {
  lobby.startGame()
  io.emit('wordPicking')

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
  const player = lobby.getPlayer(socket.data.userId!)

  const { common, won } = player.addGuess(guess)

  console.group('user guessed'.blue);
  console.log('from:  ', player.username);
  console.log('to:    ', player.opponent.username);
  console.log('word:  ', guess.word);
  console.log('common:', common);
  console.log('won:   ', won);
  console.groupEnd();

  io.emit('guessResult', {
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
  const player = lobby.getPlayer(socket.data.userId!)

  lobby.goBackToRoom(socket.data.userId!)

  console.group('joined room'.green)
  console.log('username:', player.username)
  console.groupEnd()

  // broadcast to all others that a user connected
  socket.broadcast.emit('userConnect', player.asSession());

  // resend users when rejoining so user knows 
  // who is in the room already
  const users: PlayerState[] = lobby.room.players
    .map(player => player.asPlayerState())

  // send to user all connected users
  socket.emit('users', users)
}

function onGameStateChange(event: GameEvents.GameStateChangeEvent) {
  switch(event.game.state) {
    case GameState.playing:
      io.emit('gameStart', event.game.config())

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

