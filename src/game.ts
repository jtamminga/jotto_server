import Player from './player';
import { GameState, GameStateRestore, Session, History } from './types';
import { duplicates, moveOver, shuffle } from './utils';

class Game {
  private players: Player[];
  private curPlayer: Player | undefined; // no player if game is over
  private state: GameState;
  private numWinners: number;

  private onGameStartCallback: (() => void) | undefined = undefined;

  constructor(users: Session[]) {
    this.players = this.createPlayers(users);
    this.curPlayer = this.players[0];
    this.state = GameState.PICKING_WORD;
    this.numWinners = 0;
  }

  private createPlayers(users: Session[]): Player[] {
    // shuffle userIds
    let userIds = users.map(u => u.userId);
    shuffle(userIds);

    // create player objects
    let players: Player[] = [];
    let prePlayer: Player | undefined = undefined;
    for(let i = 0; i < userIds.length; i++) {
      let session = users.find(u => u.userId === userIds[i]);

      if (!session) {
        throw new Error('No session found');
      }

      let player = new Player(userIds[i], session.username);
      player.setOpponent(prePlayer);
      players.push(player);
      prePlayer = player;
    }
    players[0].setOpponent(prePlayer);
    return players;
  }

  private getPlayer(userId: string): Player {
    const player = this.players.find(p => p.userId === userId);

    if (!player) {
      throw new Error('Player does not exist');
    }

    return player;
  }

  private getUsers(sessions: Session[]) {
    return sessions
      .map(session => {
        const player = this.getPlayer(session.userId);

        return {
          ...session,
          won: player.won,
          ready: player.ready
        }
      });
  }

  /*private*/ getGuessHistory(): History[] {
    const n = this.players.length;
    let history: History[] = [];
    let cur = this.players[0];
    
    let i = 0, j = 0;
    while (cur.guesses[i]) {
      const from = cur.userId;
      const to = cur.opponent.userId;
      const guess = cur.guesses[i];

      history.push({ from, to, ...guess });
      
      // advance
      cur = cur.opponent;
      if (++j == n) {
        j = 0;
        i++;
      };
    }

    return history;
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getPlayerOrder(): string[] {
    return this.players.map(player => player.userId);
  }

  getCurPlayer(): Player | undefined {
    return this.curPlayer;
  }

  getNextPlayer(): Player | undefined {
    if (!this.curPlayer) {
      return undefined;
    }

    let player = this.curPlayer;
    for (let i = 0; i < this.players.length; i++) {
      player = player.opponent;
      if (!player.won) return player;
    }

    return undefined;
  }

  getGameState(): GameState {
    return this.state;
  }

  setPlayerWord(userId: string, word: string): void {
    if (this.state == GameState.PICKING_WORD) {
      if (word.length == 5 && duplicates([...word]).length == 0) {
        this.getPlayer(userId).setWord(word);
        if (this.players.every(p => p.hasWord())) {
          this.state = GameState.STARTED;
          if (this.onGameStartCallback) this.onGameStartCallback();
        }
      } else {
        throw new Error('Word is not valid');
      }
    } else {
      throw new Error('Invalid game state');
    }
  }

  playerGuess(userId: string, guess: string): GuessResult {
    const player = this.getPlayer(userId);
    const common = player.addGuess(guess);

    // if the player won, record which place they are in
    if (player.won) {
      player.place = ++this.numWinners;
    }

    // set next player
    this.curPlayer = this.getNextPlayer();

    // check if the game is over
    if (this.curPlayer == null) {
      this.state = GameState.GAME_OVER;
    }

    return {
      player,
      common,
      won: player.won,
      place: player.place,
      gameOver: this.state == GameState.GAME_OVER
    };
  }

  // need sessions for connected state
  // maybe sink that with players then we don't need this
  restoreState(userId: string, sessions: Session[]): GameStateRestore {
    const users = this.getUsers(sessions);
    const player = this.getPlayer(userId);
    let playerOrder = this.getPlayerOrder();

    // adjust the first player of the player order
    // because the frontend uses the first userId for the "starting player"
    if (this.curPlayer) {
      let index = playerOrder.indexOf(this.curPlayer.userId);
      let offset = playerOrder.length - index;
      playerOrder = moveOver(playerOrder, offset);
    }

    return {
      state: this.state,
      users,
      playerOrder,
      word: player.hasWord() ? player.word : '',
      currentTurn: this.curPlayer?.userId,
      // guesses: player.guesses
      history: this.getGuessHistory()
    };
  }

  endSummary(): EndGameSummary[] {
    return [...this.players]
      .sort((a, b) => a.place - b.place)
      .map(p => ({
        userId: p.userId,
        username: p.username,
        place: p.place,
        word: p.word,
        numGuesses: p.guesses.length
      }));
  }

  // callbacks
  onGameStart(callback: () => void) {
    this.onGameStartCallback = callback;
  }
}

interface GuessResult {
  player: Player;
  common: number;
  won: boolean;
  gameOver: boolean;
  place: number;
}

interface EndGameSummary {
  userId: string;
  username: string;
  place: number;
  word: string;
  numGuesses: number;
}

export default Game;