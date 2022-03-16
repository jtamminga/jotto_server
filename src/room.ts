import { IllegalStateError } from 'jotto_core'
import User from './user'
import Users from './users'

export default class Room<T extends User> extends Users<T> {

  private _isOpen: boolean = true

  constructor(private numPlayers: number | undefined = undefined) {
    super()
  }


  //
  // getters & setters
  // =================


  public get isOpen(): boolean {
    return this._isOpen
  }

  public get isFull(): boolean {
    return this.all.length == this.numPlayers
  }


  //
  // public functions
  // ================


  public add(user: T) {
    if (!this._isOpen) {
      throw new IllegalStateError('Room is no longer open.')
    }

    if (this.isFull) {
      throw new IllegalStateError('Room is already full.')
    }

    super.add(user)
  }

  public close() {
    this._isOpen = false
    this.clear()
  }

  public open() {
    this._isOpen = true
  }
}