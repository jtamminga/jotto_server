import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import Game from './game';
import { Server } from 'socket.io';
import { JottoSocket, SessionStore, Session, UserState } from './types';

const sessionStore: SessionStore = new MemorySessionStore();
const randomId = () => randomBytes(8).toString('hex');
let game: Game = null;

const io = new Server({
  cors: {
    origin: "http://localhost:3000",
  }
});

// spin it up
io.listen(3001);

// middleware
io.use((socket: JottoSocket, next) => {
  const sessionId = socket.handshake.auth.sessionId;

  if (sessionId) {
    const session = sessionStore.findSession(sessionId);
    if (session) {
      socket.sessionId = sessionId;
      socket.userId = session.userId;
      socket.username = session.username;
      return next();
    }
  }

  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"));
  }
  socket.sessionId = randomId();
  socket.userId = randomId();
  socket.username = username;
  next();
});

io.on('connection', (socket) => {
  const users = userConnect(socket);

  if (users.length === 2 && game == null) {
    initializeGame(users);
  }

  socket.on('submit_word', submitWord.bind(this, socket));
  socket.on('submit_guess', submitGuess.bind(this, socket));
  socket.on('disconnect', userDisconnect.bind(this, socket));
});

/**
 * Handles a connected user
 * @param socket The connected socket
 * @returns All the current user sessions
 */
function userConnect(socket: JottoSocket): UserState[] {
  console.log('connection - sessionId: ', socket.sessionId);

  // save the session
  sessionStore.saveSession(socket.sessionId, {
    userId: socket.userId,
    username: socket.username,
    connected: true,
  });

  // send session details connected user
  socket.emit('session', {
    sessionId: socket.sessionId,
    userId: socket.userId
  });

  let users: UserState[];

  if (game == null) {
    users = sessionStore.allSessions().map(session => ({
      ...session,
      won: false,
      ready: false
    }));
  } else {
    users = game.getPlayers().map(player => {
      let session = sessionStore.findSession(player.userId);
      return {
        ...session,
        won: player.won,
        ready: player.ready
      }
    });
  }

  // send all connected users to the connected user
  socket.emit('users', users);
  
  // broadcast to all other that a user connected
  socket.broadcast.emit('user_connect', {
    userId: socket.userId,
    username: socket.username,
    connected: true
  });

  return users;
}

/**
 * Handle a user disconnected
 * @param socket The socket that disconnected
 */
async function userDisconnect(socket: JottoSocket) {
  const matchingSockets = await io.in(socket.userId).allSockets();
  const isDisconnected = matchingSockets.size === 0;
  if (isDisconnected) {
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
function initializeGame(users: Session[]) {
  game = new Game(users);
  game.onGameStart(() => {
    io.emit('game_start', {
      nextPlayer: game.getCurPlayer().userId,
      playerOrder: game.getPlayerOrder()
    })
  });

  io.emit('word_picking');
}

/**
 * Handle a user submitting a word
 * @param socket The socket of the submitted word
 * @param word The word submitted
 */
function submitWord(socket: JottoSocket, word: string) {
  game.setPlayerWord(socket.userId, word);
  socket.broadcast.emit('user_ready', socket.userId);
}

function submitGuess(socket: JottoSocket, guess: string) {
  const result = game.playerGuess(socket.userId, guess);

  io.emit('turn', {
    guess,
    common: result.common,
    nextPlayer: game.getCurPlayer().userId,
    gameOver: result.gameOver
  });
}

