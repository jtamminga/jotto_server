import Lobby from '../lobby'
import { Event } from './event'

export namespace LobbyEvents {

  export type EventType =
    | 'lobby_created'
    | 'lobby_destroyed'
    | 'lobby_empty'
    | 'lobby_state_change'

  export interface LobbyEvent extends Event {
    domain: 'lobby'
    type: EventType
    lobby: Lobby
  }

  export function create(type: EventType, lobby: Lobby): LobbyEvent {
    return {
      domain: 'lobby',
      type,
      lobby,
      timestamp: Date.now()
    }
  }

  export function isLobbyEvent(event: Event): event is LobbyEvent {
    return event.domain === 'lobby'
  }

}