import { Session } from './types'

class User implements Session {

  protected _userId: string
  protected _username: string
  protected _connected: boolean

  constructor({ userId, username, connected }: Session) {
    this._userId = userId
    this._username = username
    this._connected = connected
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

  public get connected(): boolean {
    return this._connected
  }

  public set connected(value: boolean) {
    this._connected = value
  }


  //
  // public functions
  // ================


  public asSession(): Session {
    return {
      userId: this._userId,
      username: this._username,
      connected: this._connected
    }
  }

}

export default User