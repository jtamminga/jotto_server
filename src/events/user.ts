import { Event } from './event'

export namespace UserEvents {

  export type EventType =
    | 'user_connected'
    | 'user_disconnected'

  export interface UserEvent extends Event {
    domain: 'server';
    type: EventType;
    userId: string;
  }

  export interface UserConnectEvent extends UserEvent {
    isReconnect: boolean
  }

  export interface UserDisconnectEvent extends UserEvent {
    wasIntended: boolean
  }

  export function userConnected(userId: string, isReconnect: boolean): UserConnectEvent {
    return {
      domain: 'server',
      type: 'user_connected',
      timestamp: Date.now(),
      userId,
      isReconnect
    }
  }

  export function userDisconnected(userId: string, wasIntended: boolean): UserDisconnectEvent {
    return {
      domain: 'server',
      type: 'user_disconnected',
      timestamp: Date.now(),
      userId,
      wasIntended
    }
  }

  export function isUserDisconnectEvent(event: Event): event is UserDisconnectEvent {
    return event.domain === 'server' && event.type === 'user_disconnected'
  }
}