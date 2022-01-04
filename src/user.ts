import { JottoSocket, Session } from './types'

class User implements Session {

  constructor(
    private _socket: JottoSocket
  ) { }


  //
  // getters & setters
  // =================


  public get userId(): string {
    return this._socket.userId
  }

  public get username(): string {
    return this._socket.username
  }

  public get connected(): boolean {
    return this._socket.connected
  }

}

export default User