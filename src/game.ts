import Player from './player'
import { shuffle } from './utils'
import { GameEvents, isPlayerEvent, PlayerEvents } from './events'
import { GameState, GameConfig, GameSummary, IllegalStateError } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter, Subscription } from 'rxjs'
import Players from './players'

@autoInjectable()
class Game extends Players {

  private _state: GameState = GameState.pickWords
  private _winners: Player[] = []
  private _subscription: Subscription

  constructor(players: ReadonlyArray<Player>, private _bus?: EventBus) {

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


  //
  // public functions
  // ================


  public config(): GameConfig {
    return {
      opponents: this._players.map(player => ({
        id: player.userId,
        opponentId: player.opponent.userId
      }))
    }
  }

  public summary(): GameSummary {
    const playerSummaries = this._winners
      .map((p, i) => ({
        userId: p.userId,
        place: i + 1,
        word: p.word,
        numGuesses: p.guesses.length
      }))

    return { playerSummaries }
  }

  public leave(userId: string): Player {
    const index = this._players.findIndex(p => p.userId === userId)
    const player = this._players[index]

    if (index === -1) {
      throw new Error('Player not found')
    }

    this._players.splice(index, 1)

    if (this._players.length === 0) {
      this._state = GameState.destroyed
      this._bus?.publish(GameEvents.stateChange(this))
    }

    return player
  }

  public dispose() {
    this._subscription.unsubscribe()
  }


  //
  // private functions
  // =================


  private onPlayerEvent(event: PlayerEvents.PlayerEvent) {
    switch(event.type) {
      case 'set_word':
        this.onSetWord()
        break
      case 'submit_guess':
        this.onSubmitGuess(event.player)
        break
    }
  }

  private onSetWord() {
    if (this._players.every(p => p.hasWord)) {
      this._state = GameState.started;
      this._bus?.publish(GameEvents.stateChange(this));
    }
  }

  private onSubmitGuess(player: Player) {
    if (player.won) {
      this._winners.push(player)
    }
    
    if (this._players.every(p => p.won)) {
      this._state = GameState.gameOver
      this._bus?.publish(GameEvents.stateChange(this))
    }
  }
}

export default Game;