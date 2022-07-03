import { singleton } from 'tsyringe'
import { EventBus } from './eventBus'
import { LobbyManager } from './lobbyManager'
import Player from './player'

@singleton()
class Pool {

  private _playerPool = new Map<string, TrackedPlayer>()
  private _potentialLobby: Player[][] = []

  constructor(
    private _lobbyManager: LobbyManager,
    private _bus: EventBus
  ) {

  }

  public add(player: Player) {
    this._playerPool.set(player.userId, {
      player,
      joinedOn: Date.now()
    })
  }

  public remove(player: Player) {
    this._playerPool.delete(player.userId)
  }

  // on x number -> fire event? (create lobby with users)
  // on user waiting y time -> fire event? (create lobby with user)

  // createLobby(users) -> fires event
  private createLobby(players: Player[]): void {
    const lobby = this._lobbyManager.create(true)
    players.forEach(player => lobby.add(player))
    lobby.startGame({ gameLength: 5 })
  }

}

export default Pool

type TrackedPlayer = {
  player: Player
  joinedOn: number
}