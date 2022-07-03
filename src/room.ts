import { IllegalStateError } from 'jotto_core'
import Player from './player'
import UserMap from './UserMap'

export default class Room extends UserMap<Player> {

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
    return this.size == this.numPlayers
  }


  //
  // public functions
  // ================


  public add(player: Player) {
    if (!this._isOpen) {
      throw new IllegalStateError('Room is no longer open.')
    }

    if (this.isFull) {
      throw new IllegalStateError('Room is already full.')
    }

    super.add(player)
  }

  public leave(player: Player) {
    super.remove(player)
  }

  public close() {
    this._isOpen = false
    this.clear()
  }

  public open() {
    this._isOpen = true
  }
}