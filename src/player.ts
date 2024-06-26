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
  private _zombie = false
  private _totalWins = 0

  constructor(
    userData: UserData,
    private _bus?: EventBus
  ) {
    super(userData)
  }


  //
  // getters & setters
  // =================


  public get zombie(): boolean {
    return this._zombie
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

  /**
   * number of wins for this lobby
   */
  public get totalWins(): number {
    return this._totalWins
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

  public addWin() {
    this._totalWins += 1
  }

  public toZombie(): Player {
    const player = new Player(this)
    player._zombie = true
    player._word = this._word
    player._guesses = [...this._guesses]
    player._opponent = this._opponent
    player._wonAt = this._wonAt
    player._connected = false
    player._state = this._state

    return player
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

  public leftLobby(): void {
    super.leftLobby()
    this._totalWins = 0
  }
}