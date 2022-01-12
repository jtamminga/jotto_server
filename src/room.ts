import Player from './player'
import Players from './players'
import { IllegalStateError } from './types'

export default class Room extends Players {

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
    return this._players.length == this.numPlayers
  }


  //
  // public functions
  // ================


  public addPlayer(player: Player) {
    if (!this._isOpen) {
      throw new IllegalStateError('Room is no longer open.')
    }

    if (this.isFull) {
      throw new IllegalStateError('Room is already full.')
    }

    this._players.push(player)
  }

  public close() {
    this._isOpen = false
    this._players = []
  }

  public open() {
    this._isOpen = true
  }
}