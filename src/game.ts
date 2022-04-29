import Player from './player'
import { shuffle } from './utils'
import { GameEvents, PlayerEvents } from './events'
import { GameState, History } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter, Subscription } from 'rxjs'
import { AppConfig } from './config'
import { comparePlayers, GameConfig, GameOverReason, GameSummary, HostConfig, IllegalStateError } from 'jotto_core'
import { addMilliseconds, addMinutes, differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns'
import Users from './users'

@autoInjectable()
class Game extends Users<Player> {

  private _state: GameState = GameState.pickingWords
  private _subscription: Subscription
  private _pickingWordOn: Date
  private _startedOn: Date | undefined
  private _endedOn: Date | undefined
  private _reason: GameOverReason | undefined
  private _summary: GameSummary | undefined

  private _pickWordTimer: ReturnType<typeof setTimeout>
  private _gameOverTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private _hostConfig: HostConfig,
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
      this.all[i].setOpponent(
        this.all[i + 1] ?? this.all[0])
    }

    this._pickingWordOn = new Date()

    // setup timer for picking a word
    this._pickWordTimer = setTimeout(() => this.onPickWordTimeUp(),
      _config!.pickWordLength * 1_000)

    // listen to player events
    this._subscription = _bus!.events$
      .pipe(
        filter(PlayerEvents.isPlayerEvent),
        filter(e => this.includes(e.player))
      )
      .subscribe(event => this.onPlayerEvent(event))
  }


  //
  // getters & setters
  // =================


  public get state(): GameState {
    return this._state
  }

  public get pickingWordOn(): Date {
    return this._pickingWordOn
  }

  public get startedOn(): Date | undefined {
    return this._startedOn
  }

  public get guesses(): History[] {
    return this.all
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
      pickWordLength: this._config!.pickWordLength,
      preGameLength: this._config!.preGameLength,
      gameLength: this._hostConfig.gameLength,
      opponents: this.all.map(player => ({
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

    const playerSummaries = this.all
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

  public leave(player: Player): void {
    
    // replace player with a zombie
    // this allows gameplay to still happen even if player left
    this.remove(player.userId)
    this.all.push(player.toZombie())

    if (this.all.every(p => p.zombie)) {
      this.updateState(GameState.destroyed)
    }
  }

  public dispose() {
    this._subscription.unsubscribe()

    clearTimeout(this._pickWordTimer)

    if (this._gameOverTimer) {
      clearTimeout(this._gameOverTimer)
    }
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
    if (this._hostConfig.gameLength !== undefined) {
      const gameLength = this._hostConfig.gameLength * 60 * 1_000 // min -> ms
      const total = preGameLength + gameLength

      // set game timer
      this._gameOverTimer = setTimeout(() => this.gameOver('time_up'), total)
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

  private onPickWordTimeUp() {
    // give random words to players that have not
    // picked a word yet
    this.all
      .filter(p => !p.hasWord)
      .forEach(p => p.setRandomWord())

    this.updateState(GameState.playing)
    this.processTimings()
  }

  private onSetWord() {
    if (this._state !== GameState.pickingWords) {
      throw new IllegalStateError(`Cannot set word in ${this._state} state`)
    }

    if (this.all.every(p => p.hasWord)) {
      clearTimeout(this._pickWordTimer)
      this.updateState(GameState.playing)
      this.processTimings()
    }
  }

  private onSubmitGuess() {
    if (this._state !== GameState.playing) {
      throw new IllegalStateError(`Cannot guess in ${this._state} state`)
    }
    
    if (this.all.every(p => p.won)) {
      this.gameOver('all_won')
    }
  }

  private gameOver(reason: GameOverReason) {
    if (this._startedOn === undefined) {
      throw new IllegalStateError('game does not have start time')
    }

    if (this._state !== GameState.playing) {
      throw new IllegalStateError('game is not in playing state')
    }

    // clear the timer
    // in the case of game ending before the timer because all one
    // make sure to clear the timer
    if (this._gameOverTimer) {
      clearTimeout(this._gameOverTimer)
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
      if (this._hostConfig.gameLength === undefined) {
        throw new IllegalStateError('game does not have a length')
      }      

      this._endedOn = addMinutes(this._startedOn, this._hostConfig.gameLength)
    }
 
    this.updateState(GameState.gameOver)
  }
}

export default Game;