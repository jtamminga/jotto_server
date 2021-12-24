import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { PlayerEvents } from './events'
import { Guess, GuessResult, GuessSubmission, Session } from './types'
import { duplicates, numIntersect } from './utils'

@autoInjectable()
export default class Player {
  
  // player info
  private _userId: string
  private _username: string

  // game info
  private _word: string | undefined
  private _guesses: Guess[]
  private _opponent: Player | undefined

  // state
  private _won: boolean

  constructor({ userId, username }: Session, private _bus?: EventBus) {
    this._userId = userId
    this._username = username

    this._word = undefined
    this._guesses = []
    this._opponent = undefined

    this._won = false
  }


  //
  // getters & setters
  // =================


  public get userId(): string {
    return this._userId
  }

  public get username(): string {
    return this._username
  }

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


  public addGuess({ id, word }: GuessSubmission): GuessResult {
    let result: GuessResult

    if (word === this.opponent.word) {
      this._guesses.push({ id, word, common: 5 })
      this._won = true
      result = { common: 5, won: true }
    } else {
      const common = numIntersect([...this.opponent.word], [...word])
      this._guesses.push({ id, word, common })
      result = { common, won: false }
    }

    this._bus?.publish(PlayerEvents.submitGuess(this, word))
    return result
  }

  public setWord(word: string) {
    if (word.length !== 5 || duplicates([...word]).length !== 0) {
      throw new Error('Word is not valid')
    }
    
    this._word = word
    this._bus?.publish(PlayerEvents.setWord(this, word))
  } 

  public setOpponent(player: Player) {
    this._opponent = player
  }
}