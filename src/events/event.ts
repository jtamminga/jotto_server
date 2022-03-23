import { UserEvents } from './user'
import { GameEvents } from './game'
import { PlayerEvents } from './player'
import { LobbyEvents } from './lobby'
import { TimeEvents } from './time'

// domains
export type EventDomain =
  | 'server'
  | 'game'
  | 'player'
  | 'lobby'

// event types
export type EventType =
  | UserEvents.EventType
  | GameEvents.EventType
  | PlayerEvents.EventType
  | LobbyEvents.EventType
  | TimeEvents.EventType
  
// base event
export interface Event {
  domain: EventDomain
  type: EventType
  timestamp: number
}