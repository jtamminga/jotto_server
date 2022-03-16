import { UserRestore, GameConfig, GameSummary, HostConfig, IllegalStateError } from 'jotto_core'
import { filter, Subscription } from 'rxjs'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { GameEvents, isGameStateChangeEvent } from './events'
import Game from './game'
import Observer from './observer'
import Player from './player'
import Room from './room'
import { Disposable, GameState, History } from './types'
import User from './user'
import Users from './users'
import { isObserver } from './utils'

export type LobbyState =
  | 'inroom'
  | 'ingame'

@autoInjectable()
class Lobby extends Users implements Disposable {

  private _subscriptions: Subscription[] = []
  private _game: Game | undefined = undefined
  private _room = new Room<Player>()
  private _state: LobbyState = 'inroom'

  constructor(
    private _code: string,
    _bus?: EventBus
  ) {
    super()

    this._subscriptions.push(_bus!.events$
      .pipe(filter(isGameStateChangeEvent))
      .subscribe(this.onGameStateChange)
    )

    // this._subscriptions.push(_bus!.events$
    //   .pipe(filter(isUserEvent))
    //   .subscribe(this.onUserEvent)
    // )
  }


  //
  // getters & setters
  // =================


  public get code(): string {
    return this._code
  }

  public get room(): Room<Player> {
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

  public get observers(): Observer[] {
    return this.all.filter(isObserver)
  }


  //
  // public functions
  // ================


  public add(user: User): void {
    if (user instanceof Player) {
      this._room.add(user)
    }

    super.add(user)
  }

  public getPlayer(userId: string): Player {
    const user: User = this.get(userId)

    if (user instanceof Player) {
      return user
    }

    throw new Error('User is not a player')
  }

  public startGame(config: HostConfig) {
    this._game = new Game(config, this._room.all)
    this._room.close()
    console.log('room closed')
    this._state = 'ingame'

    this.all
      .filter(u => u.type === 'player')
      .forEach(u => u.updateState('picking_word'))

    this.all
      .filter(u => u.type === 'observer')
      .forEach(u => u.updateState('picked_word'))
  }

  public goBackToRoom(userId: string) {
    const player = this.getPlayer(userId)
    this._game!.leave(userId)
    player.reset()
    this._room.add(player)
  }

  public userRestore(userId: string): UserRestore {
    const user = this.get(userId)
    let { state } = user

    // handle observer refreshing after game gets destroyed
    if (user.type === 'observer'
        && user.state === 'game_over'
        && this._game === undefined) {
      state = 'in_room'
    }

    const users = this.all
      .map(u => u.userState())

    let word: string | undefined
    let gameSummary: GameSummary | undefined
    let config: GameConfig | undefined
    let history: History[] | undefined
    let startedOn: number | undefined

    switch (state) {
      case 'game_over':
        gameSummary = this._game!.summary()
      case 'playing':
        config = this._game!.config()
        history = this._game!.guesses
        startedOn = this._game!.startedOn?.getTime()
      case 'picked_word':
        if (user instanceof Player) word = user.word
    }

    return {
      userId,
      users,
      state,
      history,
      startedOn,
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
      case GameState.playing:
        this.all.forEach(u => u.updateState('playing'))
        break
      case GameState.gameOver:
        this.all.forEach(u => u.updateState('game_over'))
        this._room.open()
        break
      case GameState.destroyed:
        this._game!.dispose()
        this._game = undefined
        break
    }
  }

  // private onUserEvent = (event: UserEvents.UserEvent) => {
  //   switch(event.type) {
  //     case 'user_connected':
  //       this.userConnected(event.userId)
  //       break
  //     case 'user_disconnected':
  //       const { userId, wasIntended } = event as UserEvents.UserDisconnectEvent
  //       this.userDisconnected(userId, wasIntended)
  //       break
  //   }
  // }


  //
  // private functions
  // =================


  // private userConnected(userId: string): void {
  //   const user = this.get(userId)
  //   user.connected = true
  // }

  // private userDisconnected(userId: string, intended: boolean): void {
  //   const user = this.get(userId)
  //   user.connected = false

  //   if (intended) {
  //     this.remove(userId)

  //     // also remove player from the game if there is an instance
  //     // don't need to worry about removing from the room because
  //     // it just gets clearned when closed anyways
  //     if (this._game && user instanceof Player) {
  //       this._game.leave(userId)
  //     }
  //   }
  // }
}

export default Lobby