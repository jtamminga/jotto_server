import { duplicates, numIntersect, PlayerPerf, PlayerState, UserData } from 'jotto_core'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { PlayerEvents } from './events'
import { Guess, GuessSubmission } from './types'
import User from './user'

@autoInjectable()
export default class Player extends User {

  private _word: string | undefined = undefined
  private _guesses: Guess[] = []
  private _opponent: Player | undefined = undefined
  private _wonAt: number | undefined

  constructor(
    userData: UserData,
    private _bus?: EventBus
  ) {
    super(userData)
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
    return this._wonAt !== undefined
  }

  public get wonAt(): number | undefined {
    return this._wonAt
  }

  public get opponent(): Player {
    if (!this._opponent) {
      throw new Error('Player does not have an opponent')
    }

    return this._opponent
  }
  
  public get guesses(): Guess[] {
    return this._guesses;
  }

  public get bestGuess(): number {
    return this._guesses.reduce((max, g) =>
      g.common > max ? g.common : max, 0)
  }

  public get perf(): PlayerPerf {
    return {
      numGuesses: this._guesses.length,
      bestGuess: this.bestGuess,
      wonAt: this._wonAt
    }
  }


  //
  // public functions
  // ================


  public addGuess({ id, word }: GuessSubmission): Guess {
    const date = Date.now()
    let guess: Guess

    if (word === this.opponent.word) {
      this._wonAt = new Date().getTime()
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

  public setWord(word: string, assigned: boolean = false) {
    if (word.length !== 5 || duplicates([...word]).length !== 0) {
      throw new Error('Word is not valid')
    }
    
    this._word = word
    this.updateState('picked_word')
    this._bus?.publish(PlayerEvents.setWord(this, word, assigned))
  }

  public setRandomWord() {
    const words = ['under', 'water', 'extra', 'vesta', 'spoty']
    const word = words[Math.floor(Math.random()*words.length)]
    this.setWord(word, true)
  }

  public setOpponent(player: Player) {
    this._opponent = player
  }

  public reset() {
    this._word = undefined
    this._guesses = []
    this._opponent = undefined
    this._wonAt = undefined
    this.updateState('in_room')
  }

  public userState(): PlayerState {
    return {
      ...super.userState(),
      type: 'player',
      ready: this.hasWord,
      wonAt: this._wonAt
    }
  }


  //
  // Static functions
  // ================


  /**
   * Sort winners based on least number of guesses first.
   * If tied then the person who won first.
   */
  static sortWinners(a: Player, b: Player): number {
    if (a.guesses.length === b.guesses.length) {
      return a.wonAt! - b.wonAt!
    }

    return a.guesses.length - b.guesses.length
  }

  /**
   * Sort losers based on their best guess score.
   * If tied then the person who had the least guesses.
   */
  static sortLosers(a: Player, b: Player): number {
    const aBest = a.bestGuess
    const bBest = b.bestGuess

    if (aBest === bBest) {
      return a.guesses.length - b.guesses.length
    }

    // descending (highest first)
    return bBest - aBest
  }
}