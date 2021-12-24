import Player from './player'
import { shuffle } from './utils'
import { GameEvents, isPlayerEvent, PlayerEvents } from './events'
import { GameState, GameConfig, GameSummary } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter } from 'rxjs'

@autoInjectable()
class Game {

  private _players: Player[]
  private _state: GameState = GameState.pickWords
  private _winners: Player[] = []

  constructor(players: ReadonlyArray<Player>, private _bus?: EventBus) {

    // shuffle the players
    this._players = shuffle(players)

    // then assign players to their opponent
    for (let i = 0; i < players.length; i++) {
      this._players[i].setOpponent(
        this._players[i + 1] ?? this._players[0])
    }

    _bus?.events$
      .pipe(filter(isPlayerEvent))
      .subscribe(event => this.onPlayerEvent(event))
  }


  //
  // getters & setters
  // =================


  public get players(): Player[] {
    return this._players
  }

  public get state(): GameState {
    return this._state
  }


  //
  // public functions
  // ================


  public getPlayer(userId: string): Player {
    const player = this._players
      .find(p => p.userId === userId)

    if (!player) {
      throw new Error('Player does not exist')
    }

    return player
  }

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