import Player from "./player";

export default class Players {

  constructor(protected _players: Player[] = []) { }


  //
  // getters & setters
  // =================


  public get players(): ReadonlyArray<Player> {
    return this._players
  }

  public get connectedPlayers(): ReadonlyArray<Player> {
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

}