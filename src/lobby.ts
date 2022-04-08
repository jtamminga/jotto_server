import { UserRestore, GameConfig, GameSummary, HostConfig } from 'jotto_core'
import { filter, Subscription } from 'rxjs'
import { autoInjectable } from 'tsyringe'
import { EventBus } from './eventBus'
import { GameEvents, LobbyEvents, PlayerEvents, UserEvents } from './events'
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
  private _lastActivityOn: number = Date.now()

  constructor(
    private _code: string,
    private _bus?: EventBus
  ) {
    super()

    this._subscriptions.push(_bus!.events$
      .pipe(
        filter(GameEvents.isStateChangeEvent),
        filter(e => e.game === this._game)
      )
      .subscribe(this.onGameStateChange)
    )

    this._subscriptions.push(_bus!.events$
      .pipe(
        filter(UserEvents.isUserDisconnectEvent),
        filter(e => this.all.some(u => u.userId === e.userId))
      )
      .subscribe(this.onUserDisconnect)
    )

    this._subscriptions.push(_bus!.events$
      .pipe(
        filter(PlayerEvents.isPlayerEvent),
        filter(e => this.includes(e.player))
      )
      .subscribe(this.onPlayerEvent)
    )
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

  public get game(): Game | undefined {
    return this._game
  }

  public get observers(): Observer[] {
    return this.all.filter(isObserver)
  }

  public get lastActivityOn(): number {
    return this._lastActivityOn
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
    this.updateState('ingame')

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
    this._game?.dispose()
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
        this.updateState('inroom')
        break
      case GameState.destroyed:
        this._game!.dispose()
        this._game = undefined
        break
    }
  }

  private onPlayerEvent = (event: PlayerEvents.PlayerEvent) => {
    this._lastActivityOn = event.timestamp
  }

  private onUserDisconnect = (event: UserEvents.UserDisconnectEvent) => {
    if (event.wasIntended) {
      const user = this.get(event.userId)
      user.leftGame()

      if (this.all.every(user => user.didLeave)) {
        this._bus?.publish(LobbyEvents.create('lobby_empty', this))
      }
    }
  }


  //
  // private functions
  // =================


  private updateState(state: LobbyState) {
    if (this._state !== state) {
      this._state = state
      this._lastActivityOn = Date.now()
      this._bus?.publish(LobbyEvents.create('lobby_state_change', this))
    }
  }
  
}

export default Lobby