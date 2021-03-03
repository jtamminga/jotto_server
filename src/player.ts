import { intersectLen } from './utils';

class Player {
  private _userId: string;
  private _word: string;
  private _guesses: string[];
  private _opponent: Player;
  private _won: boolean;
  private _ready: boolean;

  public get userId() : string {
    return this._userId;
  }
  
  public get won() : boolean {
    return this._won;
  }
  
  public get ready() : boolean {
    return this._ready;
  }

  public get opponent() : Player {
    return this._opponent;
  }

  public set opponent(player : Player) {
    this._opponent = player;
  }

  constructor(userId: string, opponent: Player) {
    this._userId = userId;
    this._word = null;
    this._guesses = [];
    this._ready = false;
    this._won = false;
    this._opponent = opponent;
  }

  addGuess(guess: string): number {
    this._guesses.push(guess);
    if (guess == this._opponent._word) {
      this._won = true;
    }

    return intersectLen(this._opponent._word, guess);
  }

  setWord(word: string) {
    this._word = word;
    this._ready = true;
  } 

  hasWord(): boolean {
    return this._word != null;
  }
}

export default Player;