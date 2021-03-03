import Player from './player';
import { GameState, Session } from './types';
import { duplicates, shuffle } from './utils';

class Game {
  private players: Player[];
  private curPlayer: Player;
  private state: GameState;

  private onGameStartCallback: () => void;

  constructor(users: Session[]) {
    this.players = this.createPlayers(users);
    this.curPlayer = this.players[0];
    this.state = GameState.PICKING_WORD;
  }

  private createPlayers(users: Session[]): Player[] {
    // shuffle userIds
    let userIds = users.map(u => u.userId);
    shuffle(userIds);

    // create player objects
    let players = [];
    let prePlayer = null;
    for(let i = 0; i < userIds.length; i++) {
      let player = new Player(userIds[i], prePlayer);
      players.push(player);
      prePlayer = player;
    }
    players[0].opponent = prePlayer;

    return players;
  }

  private getPlayer(userId: string): Player {
    return this.players.find(p => p.userId === userId);
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getPlayerOrder(): string[] {
    return this.players.map(player => player.userId);
  }

  getCurPlayer(): Player {
    return this.curPlayer;
  }

  getNextPlayer(): Player {
    let player = this.curPlayer;
    for (let i = 0; i < this.players.length; i++) {
      player = player.opponent;
      if (!player.won) return player;
    }

    return null;
  }

  getGameState(): GameState {
    return this.state;
  }

  setPlayerWord(userId: string, word: string): void {
    if (this.state == GameState.PICKING_WORD) {
      if (word.length == 5 && duplicates(word).length == 0) {
        this.getPlayer(userId).setWord(word);
        if (this.players.every(p => p.hasWord())) {
          this.state = GameState.STARTED;
          if (this.onGameStartCallback) this.onGameStartCallback();
        }
      } else {
        throw 'Word is not valid';
      }
    } else {
      throw 'Invalid game state';
    }
  }

  playerGuess(userId: string, guess: string): GuessResult {
    const player = this.getPlayer(userId);
    const common = player.addGuess(guess);
    const won = player.won;

    // set next player
    this.curPlayer = this.getNextPlayer();

    // check if the game is over
    if (this.curPlayer == null) {
      this.state == GameState.GAME_OVER;
    }

    return {
      player,
      common,
      won,
      gameOver: this.state == GameState.GAME_OVER
    };
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
}

export default Game;