import { GameConfig, GameSummary, HostConfig, UserData, UserRestore } from 'jotto_core'
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

export type LobbyState =
  | 'inroom'
  | 'ingame'

interface PlayerStateWithWins extends UserData {
  totalWins: number
}


@autoInjectable()
class Lobby implements Disposable {

  private _room = new Room<Player>()
  private _game: Game | undefined = undefined
  
  private _state: LobbyState = 'inroom'
  private _observers: Observer[] = []
  private _subscriptions: Subscription[] = []
  private _lastActivityOn: number = Date.now()
  private _playerWins: PlayerStateWithWins[] = []

  constructor(
    private _code: string,
    private _bus?: EventBus
  ) {
    this._subscriptions.push(_bus!.events$
      .pipe(
        filter(GameEvents.isStateChangeEvent),
        filter(e => e.game === this._game)
      )
      .subscribe(this.onGameStateChange)
    )

    this._subscriptions.push(_bus!.events$
      .pipe(filter(UserEvents.isUserDisconnectEvent))
      .subscribe(this.onUserDisconnect)
    )

    this._subscriptions.push(_bus!.events$
      .pipe(
        filter(PlayerEvents.isPlayerEvent),
        filter(e => this._game?.includes(e.player) ?? false)
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
    return this._observers
  }

  public get lastActivityOn(): number {
    return this._lastActivityOn
  }

  public get playerWins(): PlayerStateWithWins[] {
    return this._playerWins
  }

  private get allPlayers(): User[] {
    return [...this.room.all, ...(this.game?.all ?? [])]
  }


  //
  // public functions
  // ================


  public add(user: User): void {
    if (user instanceof Player) {
      this._room.add(user)
    } else if (user instanceof Observer) {
      this._observers.push(user)
    } else {
      throw new Error('unknown error type')
    }
  }

  public findUser(userId: string): User | undefined {
    return this._room.find(userId)
      || this._game?.find(userId)
      || this._observers.find(o => o.userId === userId)
  }

  public getUser(userId: string): User {
    const user = this.findUser(userId)

    if (!user) {
      throw new Error('user does not exist')
    }

    return user
  }

  public getUsersFor(user: User): User[] {
    let users: User[]

    switch (user.state) {
      case 'in_room':
        users = this._room.all
        break
      case 'picking_word':
      case 'picked_word':
      case 'playing':
      case 'game_over':
        users = this._game?.all ?? []
    }
    
    return users.concat(this._observers)
  }

  public getPlayer(userId: string): Player {
    const user = this.getUser(userId) // could just get from game

    if (user instanceof Player) {
      return user
    }

    throw new Error('user is not a player')
  }

  public startGame(config: HostConfig): Game {
    this._game = new Game(config, this._room.all)
    this._room.close()
    this.updateState('ingame')

    this._game.all
      .forEach(u => u.updateState('picking_word'))

    this._observers
      .forEach(u => u.updateState('picked_word'))

    return this._game
  }

  public goBackToRoom(userId: string) {
    const player = this.getPlayer(userId)

    // if player is already in room then stop here
    if (this._room.includes(player)) {
      console.warn(`[lobby] room already has player ${userId}`)
      return
    }

    this._game!.leave(player)
    player.reset()
    this._room.add(player)
  }

  public userRestore(userId: string): UserRestore {
    const user = this.getUser(userId)
    let { state } = user

    // handle observer refreshing after game gets destroyed
    if (user.type === 'observer'
        && user.state === 'game_over'
        && this._game === undefined) {
      state = 'in_room'
    }

    const users = this.getUsersFor(user)
      .map(u => u.userState())

    let word: string | undefined
    let gameSummary: GameSummary | undefined
    let config: GameConfig | undefined
    let history: History[] | undefined
    let pickingWordOn: number | undefined
    let startedOn: number | undefined

    switch (state) {
      case 'game_over':
        gameSummary = this._game!.summary()
      case 'playing':
        history = this._game!.guesses
        startedOn = this._game!.startedOn?.getTime()
      case 'picked_word':
        if (user instanceof Player) word = user.word
      case 'picking_word':
        config = this._game!.config()
        pickingWordOn = this._game!.pickingWordOn.getTime()
    }

    return {
      userId,
      users,
      state,
      history,
      pickingWordOn,
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
        this._game?.all.forEach(u => u.updateState('playing'))
        this._observers.forEach(o => o.updateState('playing'))
        break
      case GameState.gameOver:
        this._game?.all.forEach(u => u.updateState('game_over'))
        this._observers.forEach(o => o.updateState('game_over'))
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
    const user = this.findUser(event.userId)
    if (!user) {
      return
    }

    if (event.wasIntended) {
      if (user instanceof Player) {
        this._playerWins.push({
          ...user.userState(),
          totalWins: user.totalWins
        })

        // if a user leaves while in a room
        // remove from the room too
        if (this.room.includes(user)) {
          this.room.leave(user)
        } else if (this.game?.includes(user)) {
          this.game.leave(user)
        }
      }

      // first mark a user as left
      // this allows restores mid game with a user that left
      user.leftLobby()

      if (this.allPlayers.every(player => player.didLeave)) {
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