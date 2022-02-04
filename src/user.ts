import { PlayerLobbyState, Session, UserType } from 'jotto_core'

class User implements Session {

  protected _userId: string
  protected _username: string
  protected _connected: boolean
  protected _type: UserType
  protected _state: PlayerLobbyState

  constructor({ userId, username, connected, type }: Session) {
    this._userId = userId
    this._username = username
    this._connected = connected
    this._type = type
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

  public set connected(value: boolean) {
    this._connected = value
  }


  //
  // public functions
  // ================


  public updateState(state: PlayerLobbyState) {
    this._state = state
  }

  public asSession(): Session {
    return {
      userId: this._userId,
      username: this._username,
      connected: this._connected,
      type: this._type
    }
  }

}

export default User