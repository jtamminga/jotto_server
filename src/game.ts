import Player from './player'
import { shuffle } from './utils'
import { GameEvents, isPlayerEvent, PlayerEvents } from './events'
import { GameState, IllegalStateError, History } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter, Subscription } from 'rxjs'
import Players from './players'
import { AppConfig } from './config'
import { GameConfig, GameSummary } from 'jotto_core'

@autoInjectable()
class Game extends Players {

  private _state: GameState = GameState.pickingWords
  private _subscription: Subscription

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

  public get guesses(): History[] {
    return this._players
      .reduce<History[]>((guesses, player) =>
        guesses.concat(player.guesses.map(guess => ({
          ...guess,
          from: player.userId,
          to: player.opponent.userId
        }))), [])
      .sort(g => g.date)
  }


  //
  // public functions
  // ================


  public config(): GameConfig {
    return {
      gameLength: this._config?.gameLength,
      opponents: this._players.map(player => ({
        id: player.userId,
        opponentId: player.opponent.userId
      }))
    }
  }

  public summary(): GameSummary {
    const winners = this._players
      .filter(p => p.won)
      .sort(Player.sortWinners)
      .map((p, i) => ({
        userId: p.userId,
        place: i + 1,
        word: p.word,
        numGuesses: p.guesses.length,
        wonAt: p.wonAt
      }))

    const losers = this._players
      .filter(p => !p.won)
      .sort(Player.sortLosers)
      .map((p, i) => ({
        userId: p.userId,
        place: i + 1 + winners.length,
        word: p.word,
        numGuesses: p.guesses.length,
        wonAt: undefined
      }))

    return { playerSummaries: [ ...winners, ...losers ] }
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
    }
  }

  private onSubmitGuess() {
    if (this._state !== GameState.playing) {
      throw new IllegalStateError(`Cannot guess in ${this._state} state`)
    }
    
    if (this._players.every(p => p.won)) {
      this.updateState(GameState.gameOver)
    }
  }
}

export default Game;