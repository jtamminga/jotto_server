import Player from './player'
import { IllegalStateError } from './types'

export default class Room {
  private _players: Player[]

  constructor(private numPlayers: number) {
    this._players = []
  }

  public get players(): ReadonlyArray<Player> {
    return this._players
  }

  public get isFull(): boolean {
    return this._players.length == this.numPlayers
  }

  public addPlayer(player: Player) {
    if (this.isFull) {
      throw new IllegalStateError('Room is already full.')
    }

    this._players.push(player)
  }
}