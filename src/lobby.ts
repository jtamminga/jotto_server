import { filter, Subscription } from 'rxjs'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { GameEvents, isGameStateChangeEvent, isUserEvent, UserEvents } from './events'
import Game from './game'
import Player from './player'
import Room from './room'
import { Disposable, GameConfig, GameState, GameSummary, IllegalStateError, PlayerLobbyState, UserRestore, History } from './types'
import User from './user'
import Users from './users'
import { isPlayer } from './utils'

export type LobbyState =
  | 'inroom'
  | 'ingame'

@autoInjectable()
class Lobby extends Users implements Disposable {

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


  public addUser(user: User): void {
    this.add(user)

    if (user instanceof Player) {
      this._room.addPlayer(user)
    }
  }

  public getPlayer(userId: string): Player {
    const user: User = this.get(userId)

    if (user instanceof Player) {
      return user
    }

    throw new Error('User is not a player')
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
    const { player, state } = this.playerLobbyState(userId)
    const users = this.all
      .filter(isPlayer)
      .map(p => p.asPlayerState())

    let word: string | undefined
    let gameSummary: GameSummary | undefined
    let config: GameConfig | undefined
    let history: History[] | undefined

    switch (state) {
      case 'game_over':
        gameSummary = this._game!.summary()
      case 'playing':
        config = this._game!.config()
        history = this._game!.guesses
      case 'picked_word':
        word = player.word
    }

    return {
      userId,
      users,
      state,
      history,
      word,
      config,
      gameSummary
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
    const user = this.get(userId)
    user.connected = true
  }

  private userDisconnected(userId: string, intended: boolean): void {
    const user = this.get(userId)
    user.connected = false

    if (intended) {
      this.remove(userId)

      // also remove player from the game if there is an instance
      // don't need to worry about removing from the room because
      // it just gets clearned when closed anyways
      if (this._game && user instanceof Player) {
        this._game.leave(userId)
      }
    }
  }

  /**
   * Determine the state of the player in the lobby
   * @param userId The user to get the state for
   * @returns The player and state of player in the lobby
   */
  private playerLobbyState(userId: string): { player: Player, state: PlayerLobbyState} {
    // check if player is in room
    if (this._room.isOpen) {
      const player = this._room.findPlayer(userId)
      if (player) {
        return { player, state: 'in_room' }
      }
    }

    // check if player is in the game
    if (this._game) {
      const player = this._game.findPlayer(userId)
      if (player) {
        let state: PlayerLobbyState =
          player.hasWord ? 'picked_word' : 'picking_word'

        if (this._game.state === GameState.playing) {
          state = 'playing'
        } else if (this._game.state === GameState.gameOver) {
          state = 'game_over'
        }

        return { player, state }
      }
    }

    throw new Error('Player not found')
  }
}

export default Lobby