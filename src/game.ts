import Player from './player'
import { shuffle } from './utils'
import { GameEvents, isPlayerEvent, PlayerEvents } from './events'
import { GameState, IllegalStateError, History } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter, Subscription } from 'rxjs'
import Players from './players'
import { AppConfig } from './config'
import { comparePlayers, GameConfig, GameOverReason, GameSummary } from 'jotto_core'
import { addMilliseconds, addMinutes, differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns'

@autoInjectable()
class Game extends Players {

  private _state: GameState = GameState.pickingWords
  private _subscription: Subscription
  private _startedOn: Date | undefined
  private _endedOn: Date | undefined
  private _reason: GameOverReason | undefined
  private _summary: GameSummary | undefined

  constructor(
    players: ReadonlyArray<Player>,
    private _bus?: EventBus,
    private _config?: AppConfig
  ) {

    // shuffle the players
    super(shuffle(players))

    // make sure there is enough players
    if (players.length <= 1) {
      throw new IllegalStateError('Game must have at least 2 players')
    }

    // then assign players to their opponent
    for (let i = 0; i < players.length; i++) {
      this._players[i].setOpponent(
        this._players[i + 1] ?? this._players[0])
    }

    this._subscription = _bus!.events$
      .pipe(filter(isPlayerEvent))
      .subscribe(event => this.onPlayerEvent(event))
  }


  //
  // getters & setters
  // =================


  public get state(): GameState {
    return this._state
  }

  public get startedOn(): Date | undefined {
    return this._startedOn
  }

  public get guesses(): History[] {
    return this._players
      .reduce<History[]>((guesses, player) =>
        guesses.concat(player.guesses.map(guess => ({
          ...guess,
          from: player.userId,
          to: player.opponent.userId
        }))), [])
      .sort((a, b) => a.date - b.date)
  }


  //
  // public functions
  // ================


  public config(): GameConfig {
    return {
      preGameLength: this._config!.preGameLength,
      gameLength: this._config?.gameLength,
      opponents: this._players.map(player => ({
        id: player.userId,
        opponentId: player.opponent.userId
      }))
    }
  }

  public summary(): GameSummary {
    if (this._summary) {
      return this._summary
    }

    if (this._startedOn === undefined || this._endedOn === undefined) {
      throw new IllegalStateError('dates are not set properly')
    }

    const playerSummaries = this._players
      .sort((a, b) => comparePlayers(a.perf, b.perf))
      .map((p, i) => ({
        userId: p.userId,
        username: p.username,
        place: i + 1,
        word: p.word,
        numGuesses: p.guesses.length,
        wonAt: p.wonAt,
        bestGuess: p.bestGuess
      }))

    this._summary = {
      gameLength: differenceInSeconds(this._startedOn, this._endedOn),
      gameOverReason: this._reason!,
      playerSummaries
    }

    return this._summary
  }

  public leave(userId: string): void {
    this.removePlayer(userId)

    if (this._players.length === 0) {
      this.updateState(GameState.destroyed)
    }
  }

  public dispose() {
    this._subscription.unsubscribe()
  }


  //
  // private functions
  // =================

  
  private updateState(state: GameState) {
    const preState = this._state
    this._state = state

    if (preState !== state) {
      this._bus!.publish(GameEvents.stateChange(this))
    }
  }

  private processTimings() {
    // determine start time
    const preGameLength = this._config!.preGameLength * 1_000 // sec -> ms
    this._startedOn = addMilliseconds(Date.now(), preGameLength)

    // if game length is defined
    // then set timer for the end of the game
    if (this._config?.gameLength !== undefined) {
      const gameLength = this._config.gameLength * 60 * 1_000 // min -> ms
      const total = preGameLength + gameLength

      // set game timer
      setTimeout(() => this.gameOver('time_up'), total)
    }
  }

  private onPlayerEvent(event: PlayerEvents.PlayerEvent) {
    switch(event.type) {
      case 'set_word':
        this.onSetWord()
        break
      case 'submit_guess':
        this.onSubmitGuess()
        break
    }
  }

  private onSetWord() {
    if (this._state !== GameState.pickingWords) {
      throw new IllegalStateError(`Cannot set word in ${this._state} state`)
    }

    if (this._players.every(p => p.hasWord)) {
      this.updateState(GameState.playing)
      this.processTimings()
    }
  }

  private onSubmitGuess() {
    if (this._state !== GameState.playing) {
      throw new IllegalStateError(`Cannot guess in ${this._state} state`)
    }
    
    if (this._players.every(p => p.won)) {
      this.gameOver('all_won')
    }
  }

  private gameOver(reason: GameOverReason) {
    if (this._startedOn === undefined) {
      throw new IllegalStateError('game does not have start time')
    }

    const actualDuration = intervalToDuration({
      start: this._startedOn!,
      end: Date.now()
    })

    console.log('actual game time:', formatDuration(actualDuration))

    this._reason = reason

    if (reason === 'all_won') {
      this._endedOn = new Date()
    }
    else if (reason === 'time_up') {
      if (this._config?.gameLength === undefined) {
        throw new IllegalStateError('game does not have a length')
      }      

      this._endedOn = addMinutes(this._startedOn, this._config.gameLength)
    }
 
    this.updateState(GameState.gameOver)
  }
}

export default Game;