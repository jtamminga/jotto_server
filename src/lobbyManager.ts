import { singleton } from 'tsyringe'
import Lobby from './lobby'
import { EventBus } from './eventBus'
import { LobbyEvents, TimeEvents } from './events'
import { filter } from 'rxjs'
import { differenceInMinutes } from 'date-fns'
import { Minutes } from 'jotto_core'

@singleton()
export class LobbyManager {

  private _lobbies = new Map<string, Lobby>()

  constructor(
    private _bus: EventBus
  ) {

    _bus.events$
      .pipe(filter(TimeEvents.isTimeEvent))
      .subscribe(() => this.healthCheck())

    _bus.events$
      .pipe(filter(LobbyEvents.isLobbyEvent))
      .subscribe(this.onLobbyEvent)
  }


  //
  // getters & setters
  // =================


  public get all(): Lobby[] {
    return Array.from(this._lobbies.values())
  }

  
  //
  // public functions
  // ================


  public create(): Lobby {
    const code = this.generateUniqueCode()

    const lobby = new Lobby(code)
    this._lobbies.set(code, lobby)

    this._bus.publish(LobbyEvents.create('lobby_created', lobby))

    return lobby
  }

  public find(code: string): Lobby | undefined {
    return this._lobbies.get(code)
  }


  //
  // bus event handlers
  // ==================


  private onLobbyEvent = (e: LobbyEvents.LobbyEvent) => {
    switch (e.type) {
      case 'lobby_empty':
        this.destroyLobby(e.lobby)
        break
    }
  }


  //
  // private functions
  // =================


  private destroyLobby(lobby: Lobby) {
    lobby.dispose()
    this._lobbies.delete(lobby.code)
    this._bus.publish(LobbyEvents.create('lobby_destroyed', lobby))
    console.log(`lobby ${lobby.code} has been destroyed`)
    submitStats(lobby)
  }

  private healthCheck() {
    // this.logHealth()
    this.sweepLobbies()
  }

  private sweepLobbies() {
    let numPurged = 0
    for(let [_, lobby] of this._lobbies) {
      if (this.lobbyAge(lobby) > 60) {
        this.destroyLobby(lobby)
        numPurged++
      }
    }

    console.info(`${numPurged} out of ${this._lobbies.size} purged`)
  }

  // private logHealth() {
  //   console.group('lobby health check'.gray.bold)
  //   console.log('num lobbies:', this._lobbies.size)
  //   for(let [code, lobby] of this._lobbies) {
  //     console.group(`lobby ${code}`)
  //     console.log('users:', lobby.all.map(u => u.username))
  //     console.log('min inactive:', this.lobbyAge(lobby))
  //     console.groupEnd()
  //   }
  //   console.groupEnd()
  // }

  private lobbyAge(lobby: Lobby): Minutes {
    return differenceInMinutes(Date.now(), lobby.lastActivityOn)
  }

  private generateUniqueCode(): string {
    const curCodes = Array.from(this._lobbies.keys())
    let newCode: string | undefined
  
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      if (!curCodes.includes(code)) {
        newCode = code
        break
      }
    }
    
    if (!newCode) {
      throw new Error('could not create unique lobby code')
    }
  
    return newCode
  }

}


// #region helper functions


/**
 * Generate a four digit pin
 * @returns four digit pin
 */
function generateCode(): string {
  return (Math.floor(Math.random() * 10000) + 10000).toString().substring(1)
}

function submitStats(lobby: Lobby) {
  const GAMEKEEPER_URL = process.env.GAMEKEEPER_URL

  if (GAMEKEEPER_URL === undefined) {
    console.log('no gamekeeper url specified: skipping submitting stats')
    return
  }

  const RECORD_ENDPOINT = GAMEKEEPER_URL + '/playthroughs'

  const stats = {
    game: 'vying',
    // playerwins keeps track of all users, even ones that did leave earlier games
    players: lobby.playerWins.map(player => player.username),
    scores: lobby.playerWins.map(stats => ({
      player: stats.username,
      score: stats.totalWins
    }))
  }

  console.info(`submitting stats to ${RECORD_ENDPOINT}:`, stats)
  fetch(RECORD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats)
  }).then((res) => {
    if (res.ok) {
      console.log('successfully submitted stats')
    } else {
      console.error('failed to submit stats')
    }
  })
}


// #endregion