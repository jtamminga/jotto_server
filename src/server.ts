import 'reflect-metadata'
import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import Game from './game';
import { Socket, Server } from 'socket.io';
import { JottoSocket, SessionStore, Session, UserState, GameState, GuessSubmission } from './types';
import 'colors';
import { filter } from 'rxjs';
import { GameEvents, UserEvents } from './events';
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
const room = new Room();

const io = new Server({
  cors: {
    origin: "http://localhost:3000"
  }
});

// spin it up
io.listen(3001);
console.log('server started'.cyan)

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
  socket.on('disconnect', (reason) => userDisconnect(socket, reason));
  socket.on('start_game', () => startGame());
  socket.on('submit_word', (word) => submitWord(socket, word));
  socket.on('submit_guess', (guess) => submitGuess(socket, guess));
  socket.on('rejoin_room', () => rejoinRoom(socket));

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
  room.addPlayer(new Player(socket));
  
  // broadcast to all others that a user connected
  socket.broadcast.emit('user_connect', session);

  // send all connected users including the user just connected
  // to just the connected user
  // this allows the connected user to see any users that 
  // connected before 
  sendUsers(socket);

  // publish event
  eventBus.publish(UserEvents.userConnected(session));
}

/**
 * Send users to user including the user itself
 * @param socket The connected socket
 */
function sendUsers(socket: JottoSocket) {
  const users: UserState[] = sessionStore.allSessions()
    .filter(s => s.connected)
    .map(session => ({
      ...session,
      won: false,
      ready: false
    }));

    // send all connected users to the connected user
    socket.emit('users', users);
}

/**
 * Start the game
 */
function startGame() {
  game = new Game(room.connectedPlayers);
  room.close();
  io.emit('word_picking');

  console.group('game started'.cyan);
  console.log('in game:'.bold)
  game.players.forEach(p =>
    console.log(`- ${p.username} (userId: ${p.userId})`))
  console.groupEnd();
}

/**
 * Handle a user disconnected
 * @param socket The socket that disconnected
 */
async function userDisconnect(socket: JottoSocket, reason: string) {
  const matchingSockets = await io.in(socket.userId).allSockets();
  const isDisconnected = matchingSockets.size === 0;
  const intended = reason === 'client namespace disconnect'

  if (isDisconnected) {
    console.group('user disconnected'.red);
    console.log('username: ', socket.username);
    console.log('sessionId:', socket.sessionId);
    console.log('userId:   ', socket.userId);
    console.log('indtended:', intended);
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

    // if game over then any disconnects
    // is concidered a leave
    if (game && game.state == GameState.gameOver) {
      game.leave(socket.userId);
    }
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
function submitGuess(socket: JottoSocket, guess: GuessSubmission) {
  const player = game!.getPlayer(socket.userId)

  const { common, won } = player.addGuess(guess)

  console.group('user guessed'.blue);
  console.log('from:  ', player.username);
  console.log('to:    ', player.opponent.username);
  console.log('word:  ', guess.word);
  console.log('common:', common);
  console.log('won:   ', won);
  console.groupEnd();

  io.emit('guess_result', {
    ...guess,
    common,
    won,
    from: player.userId,
    to: player.opponent.userId
  });
}

/**
 * Handle user rejoining room after finishing game
 * @param socket The socket that submitted event
 */
function rejoinRoom(socket: JottoSocket) {
  const player = game!.leave(socket.userId)
  player.reset()
  room.addPlayer(player)

  console.group('joined room'.green)
  console.log('username:', player.username)
  console.groupEnd()

  const sessions = sessionStore.allSessions()
  const findSession = (userId: string): Session =>
    sessions.find(s => s.userId === userId)!

  // resend users when rejoining so user knows 
  // who is in the room already
  const users: UserState[] = room.players
    .map(player => findSession(player.userId))
    .map(session => ({ ...session, ready: false, won: false }))

  // send to user all connected users
  socket.emit('users', users)
  // broadcast to all others that a user connected
  socket.broadcast.emit('user_connect', sessionStore.findSession(socket.sessionId));
}

function onGameStateChange(event: GameEvents.GameStateChangeEvent) {
  switch(event.game.state) {
    case GameState.started:
      io.emit('game_start', event.game.config())

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

      room.open()
      io.emit('end_game_summary', event.game.summary())
      break

    case GameState.destroyed:
      console.log('game destroyed'.cyan)

      game!.dispose()
      game = undefined
  }
}

