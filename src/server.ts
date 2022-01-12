import 'reflect-metadata'
import 'colors';
import MemorySessionStore from './memorySessionStore';
import { randomBytes } from 'crypto';
import { Socket, Server } from 'socket.io';
import { JottoSocket, GameState, GuessSubmission, PlayerState } from './types';
import { filter } from 'rxjs';
import { GameEvents, UserEvents } from './events';
import Player from './player';
import { container } from 'tsyringe';
import { EventBus } from './eventBus';
import Lobby from './lobby';

// event bus
const eventBus = container.resolve(EventBus)

eventBus.events$
  .pipe(filter(GameEvents.isStateChange))
  .subscribe(onGameStateChange);

const randomId = () => randomBytes(8).toString('hex');

// 
const lobby = new Lobby()
const sessionStore = new MemorySessionStore()

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
  let player = lobby.findPlayer(socket.userId)
  let isReconnect = !!player

  console.group('user connected'.green);
  console.log('username:  ', socket.username);
  console.log('sessionId: ', socket.sessionId);
  console.log('userId:    ', socket.userId);
  console.log('reconnect: ', isReconnect);
  console.groupEnd();

  // need to create a new player
  if (!player) {

    // send session details to connected user
    socket.emit('session', {
      sessionId: socket.sessionId,
      userId: socket.userId
    });

    player = new Player({
      userId: socket.userId,
      username: socket.username,
      connected: true
    })

    sessionStore.saveSession(socket.sessionId, player.asSession())
  
    // add player to the lobby
    lobby.addPlayer(player)
  }
  
  // broadcast to all others that a user connected
  socket.broadcast.emit('user_connect', player.asSession())

  eventBus.publish(UserEvents.userConnected(socket.userId, isReconnect))

  if (isReconnect) {
    socket.emit('restore', lobby.userRestore(player.userId))
  } else {
    // send all connected users including the user just connected
    // to just the connected user
    // this allows the connected user to see any users that 
    // connected before 
    sendUsers(socket)
  }
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
    console.log('intended: ', intended);
    console.groupEnd();

    // notify other users
    socket.broadcast.emit('user_disconnect', socket.userId);

    eventBus.publish(UserEvents.userDisconnected(socket.userId, intended))
  }
}

/**
 * Send users to user including the user itself
 * @param socket The connected socket
 */
function sendUsers(socket: JottoSocket) {
    const playerStates = lobby.connectedPlayers
      .map(p => p.asPlayerState())

    // send all connected users to the connected user
    socket.emit('users', playerStates)
}

/**
 * Start the game
 */
function startGame() {
  lobby.startGame()
  io.emit('word_picking')

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
  const player = lobby.getPlayer(socket.userId)

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
  const player = lobby.getPlayer(socket.userId)

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
  const player = lobby.getPlayer(socket.userId)

  lobby.goBackToRoom(socket.userId)

  console.group('joined room'.green)
  console.log('username:', player.username)
  console.groupEnd()

  // broadcast to all others that a user connected
  socket.broadcast.emit('user_connect', player.asSession());

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
      io.emit('end_game_summary', event.game.summary())
      break

    case GameState.destroyed:
      console.log('game destroyed'.cyan)
  }
}

