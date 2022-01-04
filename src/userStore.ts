import User from './user'

export default class UserStore {

  private _users: Map<string, User>

  constructor() {
    this._users = new Map()
  }

  find(sessionId: string): User | undefined {
    return this._users.get(sessionId)
  }

  save(sessionId: string, user: User): void {
    this._users.set(sessionId, user)
  }

  all(): User[] {
    return [...this._users.values()]
  }

}