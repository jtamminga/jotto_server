import Player from "./player";

export default class Players {

  constructor(protected _players: Player[] = []) { }


  //
  // getters & setters
  // =================


  public get players(): Player[] {
    return this._players
  }

  public get connectedPlayers(): Player[] {
    return this._players.filter(p => p.connected)
  }

  //
  // public functions
  // ================


  public getPlayer(userId: string): Player {
    const player = this._players
      .find(p => p.userId === userId)

    if (!player) {
      throw new Error('Player does not exist')
    }

    return player
  }

  public findPlayer(userId: string): Player | undefined {
    return this._players.find(p => p.userId === userId)
  }


  //
  // protected functions
  // ===================


  protected removePlayer(userId: string): void {
    const index = this._players.findIndex(p => p.userId === userId)

    if (index === -1) {
      throw new Error('Player not found')
    }

    this._players.splice(index, 1)
  }
}