import { Session, duplicates, numIntersect } from 'jotto_core'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { PlayerEvents } from './events'
import { Guess, GuessSubmission, PlayerState } from './types'
import User from './user'

@autoInjectable()
export default class Player extends User {

  private _word: string | undefined = undefined
  private _guesses: Guess[] = []
  private _opponent: Player | undefined = undefined
  private _won: boolean = false

  constructor(session: Session, private _bus?: EventBus) {
    super(session)
  }


  //
  // getters & setters
  // =================


  public get word(): string {
    if (!this._word) {
      throw new Error('Player does not have a word set')
    }

    return this._word
  }

  public get hasWord(): boolean {
    return this._word !== undefined
  }
  
  public get won(): boolean {
    return this._won
  }

  public get opponent(): Player {
    if (!this._opponent) {
      throw new Error('Player does not have an opponent')
    }

    return this._opponent
  }
  
  public get guesses() : Guess[] {
    return this._guesses;
  }


  //
  // public functions
  // ================


  public addGuess({ id, word }: GuessSubmission): Guess {
    const date = Date.now()
    let guess: Guess

    if (word === this.opponent.word) {
      this._won = true
      guess = { id, word, date, common: 5, won: true }
      this._guesses.push(guess)
    } else {
      const common = numIntersect([...this.opponent.word], [...word])
      guess = { id, word, date, common, won: false }
      this._guesses.push(guess)
    }

    this._bus?.publish(PlayerEvents.submitGuess(this, guess))
    return guess
  }

  public setWord(word: string) {
    if (word.length !== 5 || duplicates([...word]).length !== 0) {
      throw new Error('Word is not valid')
    }
    
    this._word = word
    this._bus?.publish(PlayerEvents.setWord(this))
  } 

  public setOpponent(player: Player) {
    this._opponent = player
  }

  public reset() {
    this._word = undefined
    this._guesses = []
    this._opponent = undefined
    this._won = false
  }

  public asPlayerState(): PlayerState {
    return {
      ...this.asSession(),
      ready: this.hasWord,
      won: this._won
    }
  }
}