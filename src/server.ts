import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import Game from './game';
import { Socket, Server } from 'socket.io';
import { JottoSocket, SessionStore, Session, UserState } from './types';
import 'colors';

let game: Game | undefined = undefined;
const sessionStore: SessionStore = new MemorySessionStore();
const randomId = () => randomBytes(8).toString('hex');
const gameCreated = () => game !== undefined;
const numPlayers = 2;

function getGame(): Game {
  if (game) return game;
  throw new Error('Game is not instaniated');
}

const io = new Server({
  cors: {
    origin: "http://localhost:3000",
  }
});

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
  const users = userConnect(socket);

  socket.on('disconnect', userDisconnect.bind(this, socket));

  // socket.onAny((event) => {
  //   console.log(`[${event}]`.gray.bold, 'from'.gray, socket.username.gray.italic);
  // });

  if (users.length === numPlayers) {
    if (gameCreated()) {
      const game = getGame();
      sendGameState(socket, game);
      setupListeners(game, socket);
    } else {
      sendUsers(socket);
      game = initializeGame(users);
      io.emit('word_picking');
    }
  } else {
    sendUsers(socket);
  }  
});

/**
 * Handles a connected user
 * @param socket The connected socket
 * @returns All the current user sessions
 */
function userConnect(socket: JottoSocket): Session[] {
  console.group('user connected'.green);
  console.log('username: ', socket.username);
  console.log('sessionId:', socket.sessionId);
  console.log('userId:   ', socket.userId);
  console.groupEnd();

  // save the session
  sessionStore.saveSession(socket.sessionId, {
    userId: socket.userId,
    username: socket.username,
    connected: true,
  });

  // send session details to connected user
  socket.emit('session', {
    sessionId: socket.sessionId,
    userId: socket.userId
  });
  
  // broadcast to all other that a user connected
  socket.broadcast.emit('user_connect', {
    userId: socket.userId,
    username: socket.username,
    connected: true
  });

  return sessionStore.allSessions();
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

function sendGameState(socket: JottoSocket, game: Game) {
  const state = game.restoreState(socket.userId,
    sessionStore.allSessions());

  socket.emit('restore_state', state);
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
    // update session status
    sessionStore.saveSession(socket.sessionId, {
      userId: socket.userId,
      username: socket.username,
      connected: false,
    });
  }
}

/**
 * Initialize and start the game
 * @param socket The socket
 * @param users All the user sessions
 */
function initializeGame(users: Session[]): Game {
  const game = new Game(users);

  // called when all players set their words
  game.onGameStart(() => {
    io.emit('game_start', {
      nextPlayer: game.getCurPlayer()?.userId,
      playerOrder: game.getPlayerOrder()
    })
  });

  setupListeners(game);

  return game;
}

function setupListeners(game: Game, socket?: JottoSocket) {
  const forSocket = (socket: JottoSocket) => {
    socket.on('submit_word', submitWord.bind(this, socket, game));
    socket.on('submit_guess', submitGuess.bind(this, socket, game));
  }

  if (socket) {
    forSocket(socket);
    return;
  }

  // add listeners to each socket
  // these listeners depend on the game
  for (let socket of io.of('/').sockets.values()) {
    // let jottoSocket = socket as JottoSocket;
    // socket.on('submit_word', submitWord.bind(this, jottoSocket, game));
    // socket.on('submit_guess', submitGuess.bind(this, jottoSocket, game));
    forSocket(socket as JottoSocket);
  }
}

/**
 * Handle a user submitting a word
 * @param socket The socket of the submitted word
 * @param word The word submitted
 */
// @ts-ignore
function submitWord(socket: JottoSocket, game: Game, word: string) {
  console.group('word submitted'.magenta);
  console.log('user: ', socket.username);
  console.log('word: ', word.bold);
  console.groupEnd();

  game.setPlayerWord(socket.userId, word);
  socket.broadcast.emit('user_ready', socket.userId);
}

function submitGuess(socket: JottoSocket, game: Game, word: string) {
  const result = game.playerGuess(socket.userId, word);

  console.group('user guessed'.blue);
  console.log('from:  ', result.player.username);
  console.log('to:    ', result.player.opponent.username);
  console.log('word:  ', word);
  console.log('common:', result.common);
  console.log('won:   ', result.won);
  console.groupEnd();

  console.group('game history'.dim);
  console.log('history', game.getGuessHistory());
  console.groupEnd();

  io.emit('turn', {
    word,
    common: result.common,
    nextPlayer: game.getCurPlayer()?.userId,
    gameOver: result.gameOver,
    won: result.won
  });

  if (result.gameOver) {
    io.emit('end_game_summary', game.endSummary());
  }
}

