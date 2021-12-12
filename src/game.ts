import Player from './player'
import { shuffle } from './utils'
import { GameEvents, isPlayerEvent, PlayerEvents } from './events'
import { GameState, EndGameSummary } from './types'
import { EventBus } from './eventBus'
import { autoInjectable } from 'tsyringe'
import { filter } from 'rxjs'

@autoInjectable()
class Game {

  private _players: Player[]
  private _state: GameState = GameState.pickWords
  private _numWinners: number = 0

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
      .subscribe(this.onPlayerEvent)
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

  public summary(): EndGameSummary[] {
    return [...this._players]
      .sort((a, b) => a.placement - b.placement)
      .map(p => ({
        userId: p.userId,
        username: p.username,
        place: p.placement,
        word: p.word,
        numGuesses: p.guesses.length
      }))
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
      player.setPlacement(++this._numWinners)
    }
    
    if (this._players.every(p => p.won)) {
      this._state = GameState.gameOver
      this._bus?.publish(GameEvents.stateChange(this))
    }
  }
}

export default Game;