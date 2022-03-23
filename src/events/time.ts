import { Event } from './event'

export namespace TimeEvents {

  export type EventType =
    | 'tick'

  export interface TimeEvent extends Event {
    domain: 'server'
    type: EventType
  }

  export function create(type: EventType): TimeEvent {
    return {
      domain: 'server',
      type,
      timestamp: Date.now()
    }
  }

  export function isTimeEvent(event: Event): event is TimeEvent {
    return event.domain === 'server' && event.type === 'tick'
  }
}