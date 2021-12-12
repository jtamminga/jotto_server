import 'reflect-metadata'
import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import Game from './game';
import { Socket, Server } from 'socket.io';
import { JottoSocket, SessionStore, Session, UserState, GameState } from './types';
import 'colors';
import { filter } from 'rxjs';
import { GameEvents, isGameEvent, UserEvents } from './events';
import Room from './room';
import Player from './player';
import { container } from 'tsyringe';
import { EventBus } from './eventBus';

// event bus
const eventBus = container.resolve(EventBus)

eventBus.events$
  .pipe(filter(GameEvents.isStateChange))
  .subscribe(onGameStateChange);

const sessionStore: SessionStore = new MemorySessionStore();
const randomId = () => randomBytes(8).toString('hex');

// 
let game: Game | undefined;
const room = new Room(2);

const io = new Server({
  cors: {
    origin: "http://localhost:3000"
  }
});
isGameEvent
// spin it up
io.listen(3001);

// middleware
io.use((socket: Socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  const jottoSocket = socket as JottoSocket;

  if (sessionId) {
    const session = sessionStore.findSession(sessionId);
    if (session) {
      jottoSocket.sessionId = sessionId;
      jottoSocket.userId = session.userId;
      jottoSocket.username = session.username;
      return next();
    }
  }

  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"));
  }
  jottoSocket.sessionId = randomId();
  jottoSocket.userId = randomId();
  jottoSocket.username = username;
  next();
});

io.on('connection', (socket: JottoSocket) => {

  // setup listeners on connected socket
  socket.on('disconnect', () => userDisconnect(socket));
  socket.on('submit_word', (word) => submitWord(socket, word));
  socket.on('submit_guess', (word) => submitGuess(socket, word));

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
  console.group('user connected'.green);
  console.log('username: ', socket.username);
  console.log('sessionId:', socket.sessionId);
  console.log('userId:   ', socket.userId);
  console.groupEnd();

  const session: Session = {
    userId: socket.userId,
    username: socket.username,
    connected: true,
  };

  // save the session
  sessionStore.saveSession(socket.sessionId, session);

  // send session details to connected user
  socket.emit('session', {
    sessionId: socket.sessionId,
    userId: socket.userId
  });

  // create player and add to room
  room.addPlayer(new Player(session));
  
  // broadcast to all others that a user connected
  socket.broadcast.emit('user_connect', session);

  // send all connected users including the user just connected
  // to just the connected user
  // this allows the connected user to see any users that 
  // connected before 
  sendUsers(socket);

  // publish event
  eventBus.publish(UserEvents.userConnected(session));

  if (room.isFull) {
    game = new Game(room.players);
    io.emit('word_picking');
  }
}

function sendUsers(socket: JottoSocket) {
  const users: UserState[] = sessionStore.allSessions()
    .map(session => ({
      ...session,
      won: false,
      ready: false
    }));

    // send all connected users to the connected user
    socket.emit('users', users);
}

/**
 * Handle a user disconnected
 * @param socket The socket that disconnected
 */
async function userDisconnect(socket: JottoSocket) {
  const matchingSockets = await io.in(socket.userId).allSockets();
  const isDisconnected = matchingSockets.size === 0;
  if (isDisconnected) {
    console.group('user disconnected'.red);
    console.log('username: ', socket.username);
    console.log('sessionId:', socket.sessionId);
    console.log('userId:   ', socket.userId);
    console.groupEnd();

    // notify other users
    socket.broadcast.emit('user_disconnect', socket.userId);

    const session: Session = {
      userId: socket.userId,
      username: socket.username,
      connected: false,
    }

    // update session status
    sessionStore.saveSession(socket.sessionId, session);

    // publish event
    eventBus.publish(UserEvents.userDisconnected(session))
  }
}

/**
 * Handle a user submitting a word
 * @param socket The socket of the submitted word
 * @param word The word submitted
 */
function submitWord(socket: JottoSocket, word: string) {
  const player = game!.getPlayer(socket.userId)

  console.group('word submitted'.magenta);
  console.log('user: ', player.username);
  console.log('word: ', word.bold);
  console.groupEnd();

  player.setWord(word)
  socket.broadcast.emit('user_ready', socket.userId);
}

/**
 * Handle a submit guess
 * @param socket The socket that submitted the guess
 * @param word The guess that was made
 */
function submitGuess(socket: JottoSocket, word: string) {
  const player = game!.getPlayer(socket.userId)

  const { common, won } = player.addGuess(word)

  console.group('user guessed'.blue);
  console.log('from:  ', player.username);
  console.log('to:    ', player.opponent.username);
  console.log('word:  ', word);
  console.log('common:', common);
  console.log('won:   ', won);
  console.groupEnd();

  io.emit('turn', {
    word,
    common,
    won
  });
}

function onGameStateChange(event: GameEvents.GameStateChangeEvent) {
  switch(event.game.state) {
    case GameState.started:
      io.emit('game_start')
      break
    case GameState.gameOver:
      io.emit('end_game_summary', game!.summary())
      break
  }
}

