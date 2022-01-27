import User from "./user";

export default class Users<T extends User = User> {

  constructor(private _users: T[] = []) { }


  //
  // getters & setters
  // =================


  public get all(): T[] {
    return this._users
  }

  public get connected(): T[] {
    return this._users.filter(u => u.connected)
  }


  //
  // public functions
  // ================


  public get(userId: string): T {
    const user = this._users
      .find(p => p.userId === userId)

    if (!user) {
      throw new Error('User does not exist')
    }

    return user
  }

  public find(userId: string): T | undefined {
    return this._users.find(p => p.userId === userId)
  }


  //
  // protected functions
  // ===================


  protected add(user: T): void {
    this._users.push(user)
  }

  protected remove(userId: string): void {
    const index = this._users.findIndex(p => p.userId === userId)

    if (index === -1) {
      throw new Error('User not found')
    }

    this._users.splice(index, 1)
  }

}