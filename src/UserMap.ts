import User from './user'
import UserCollection from './UserCollection'

class UserMap<T extends User> implements UserCollection<T> {

  private _users = new Map<string, T>()

  constructor(users: T[] = []) {
    this.add(users)
  }

  public get all(): ReadonlyArray<T> {
    return Array.from(this._users.values())
  }

  public get size(): number {
    return this._users.size
  }

  public find(id: string): T | undefined {
    return this._users.get(id)
  }

  public includes(user: T): boolean {
    return this._users.has(user.userId)
  }

  protected add(users: T | T[]): void {
    const collection = Array.isArray(users) ? users : [users]

    for (const user of collection) {
      this._users.set(user.userId, user)
    }
  }

  protected remove(user: T): void {
    this._users.delete(user.userId)
  }

  protected clear(): void {
    this._users.clear()
  }

}

export default UserMap