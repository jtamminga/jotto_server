import { PlayerLobbyState, UserData, UserState, UserType } from 'jotto_core'

abstract class User implements UserData {

  protected _userId: string
  protected _username: string
  protected _type: UserType
  protected _host: boolean
  protected _lobbyCode: string

  protected _connected: boolean
  protected _state: PlayerLobbyState

  constructor({ userId, username, type, host, lobbyCode }: UserData) {
    this._userId = userId
    this._username = username
    this._type = type
    this._host = host
    this._lobbyCode = lobbyCode

    this._connected = true
    this._state = 'in_room'
  }


  //
  // getters & setters
  // =================


  public get userId(): string {
    return this._userId
  }

  public get username(): string {
    return this._username
  }

  public get state(): PlayerLobbyState {
    return this._state
  }

  public get connected(): boolean {
    return this._connected
  }

  public get type(): UserType {
    return this._type
  }

  public get host(): boolean {
    return this._host
  }

  public get lobbyCode(): string {
    return this._lobbyCode
  }

  public set connected(value: boolean) {
    this._connected = value
  }


  //
  // public functions
  // ================


  public updateState(state: PlayerLobbyState) {
    this._state = state
  }

  public userState(): UserState {
    return {
      userId: this._userId,
      username: this._username,
      connected: this._connected,
      type: this._type,
      host: this._host,
      lobbyCode: this._lobbyCode
    }
  }

}

export default User