import { filter, Subscription } from 'rxjs'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { GameEvents, isGameStateChangeEvent, isUserEvent, UserEvents } from './events'
import Game from './game'
import Player from './player'
import Players from './players'
import Room from './room'
import { Disposable, GameConfig, GameState, GameSummary, IllegalStateError, PlayerLobbyState, UserRestore } from './types'

export type LobbyState =
  | 'inroom'
  | 'ingame'

@autoInjectable()
class Lobby extends Players implements Disposable {

  private _subscriptions: Subscription[] = []
  private _game: Game | undefined = undefined
  private _room: Room = new Room()
  private _state: LobbyState = 'inroom'

  constructor(_bus?: EventBus) {
    super()

    this._subscriptions.push(_bus!.events$
      .pipe(filter(isGameStateChangeEvent))
      .subscribe(this.onGameStateChange)
    )

    this._subscriptions.push(_bus!.events$
      .pipe(filter(isUserEvent))
      .subscribe(this.onUserEvent)
    )
  }


  //
  // getters & setters
  // =================


  public get room(): Room {
    return this._room
  }

  public get state(): LobbyState {
    return this._state
  }

  public get game(): Game {
    if (!this._game) {
      throw new IllegalStateError('No game currently')
    }

    return this._game
  }


  //
  // public functions
  // ================


  public addPlayer(player: Player): void {
    this._players.push(player)
    this._room.addPlayer(player)
  }

  public startGame() {
    this._game = new Game(this._room.players)
    this._room.close()
    this._state = 'ingame'
  }

  public goBackToRoom(userId: string) {
    const player = this.getPlayer(userId)
    this._game!.leave(userId)
    player.reset()
    this._room.addPlayer(player)
  }

  public userRestore(userId: string): UserRestore {
    const userLobbyState = this.userLobbyState(userId)
    const users = this.players.map(p => p.asPlayerState())
    let history = this._game?.guesses

    return {
      ...userLobbyState,
      userId,
      users,
      history
    }
  }

  public dispose() {
    this._subscriptions.forEach(s => s.unsubscribe())
  }


  //
  // bus handlers
  // ============


  private onGameStateChange = (event: GameEvents.GameStateChangeEvent) => {
    switch (event.state) {
      case GameState.gameOver:
        this._room.open()
        break
      case GameState.destroyed:
        this._game!.dispose()
        this._game = undefined
        break
    }
  }

  private onUserEvent = (event: UserEvents.UserEvent) => {
    switch(event.type) {
      case 'user_connected':
        this.userConnected(event.userId)
        break
      case 'user_disconnected':
        const { userId, wasIntended } = event as UserEvents.UserDisconnectEvent
        this.userDisconnected(userId, wasIntended)
        break
    }
  }


  //
  // private functions
  // =================


  private userConnected(userId: string): void {
    const player = this.getPlayer(userId)

    player.connected = true
  }

  private userDisconnected(userId: string, intended: boolean): void {
    const player = this.getPlayer(userId)

    player.connected = false

    if (intended) {
      this.removePlayer(userId)
    }
  }

  private userLobbyState(userId: string): PlayerStateInfo {
    if (this._room.isOpen) {
      const player = this._room.findPlayer(userId)
      if (player) {
        return { state: 'in_room' }
      }
    }

    if (this._game) {
      const player = this._game.findPlayer(userId)
      if (player) {
        let state: PlayerLobbyState
        let word: string | undefined
        let gameSummary: GameSummary | undefined
        let config: GameConfig | undefined

        if (player.hasWord) {
          state = 'picked_word'
          word = player.word
        } else {
          state = 'picking_word'
        }

        if (this._game.state === GameState.playing) {
          state = 'playing'
          config = this._game.config()
        } else if (this._game.state === GameState.gameOver) {
          state = 'game_over'
          config = this._game.config()
          gameSummary = this._game.summary()
        }


        return { state, word, config, gameSummary }
      }
    }

    throw new Error('Player not found')
  }
}

export default Lobby

type PlayerStateInfo = {
  state: PlayerLobbyState
  word?: string
  config?: GameConfig
  gameSummary?: GameSummary
}