import { Session } from './types'

class User implements Session {
  constructor(
    private _userId: string,
    private _username: string,
    private _connected: boolean = true
  ) { }

  public get userId(): string {
    return this._userId
  }

  public get username(): string {
    return this._username
  }

  public get connected(): boolean {
    return this._connected
  }
}

export default User