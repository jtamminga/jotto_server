import { Guess } from './types';
import { numIntersect } from './utils';

class Player {
  private _userId: string;
  private _username: string;
  private _word: string | undefined;
  private _guesses: Guess[];
  private _won: boolean;
  private _opponent: Player | undefined;

  place: number;

  public get userId(): string {
    return this._userId;
  }

  public get username(): string {
    return this._username;
  }

  public get word(): string {
    if (!this._word) {
      throw new Error('Opponent does not have a word set');
    }

    return this._word;
  }
  
  public get won(): boolean {
    return this._won;
  }
  
  public get ready(): boolean {
    return this.hasWord();
  }

  public get opponent(): Player {
    if (!this._opponent) {
      throw new Error('Player does not have an opponent');
    }

    return this._opponent;
  }
  
  public get guesses() : Guess[] {
    return this._guesses;
  }
  
  constructor(userId: string, username: string) {
    this._userId = userId;
    this._username = username;
    this._word = undefined;
    this._guesses = [];
    this._won = false;
    this._opponent = undefined;

    this.place = 0;
  }

  setOpponent(opponent: Player | undefined) {
    this._opponent = opponent;
  }

  addGuess(guess: string): number {
    if (!this._opponent) {
      throw new Error('Player does not have an opponent');
    }

    if (!this._opponent._word) {
      throw new Error('Opponent does not have a word set');
    }

    if (guess === this._opponent._word) {
      this._guesses.push({ guess, common: 5 });
      this._won = true;
      return 5;
    }

    const common = numIntersect([...this._opponent._word], [...guess]);
    this._guesses.push({ guess, common });    

    return common;
  }

  setWord(word: string) {
    this._word = word;
  } 

  hasWord(): boolean {
    return this._word !== undefined;
  }
}

export default Player;