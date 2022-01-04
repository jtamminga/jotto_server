import Game from "./game";
import Player from "./player";
import { Session } from "./types";

// domains
export type EventDomain = 'server' | 'game' | 'player';

// event types
export type EventType = UserEvents.EventType | GameEvents.EventType | PlayerEvents.EventType;
  
// base event
export interface Event {
  domain: EventDomain;
  type: EventType;
  timestamp: number;
}

export namespace UserEvents {
  export type EventType = 'user_connected' | 'user_disconnected';

  export interface UserEvent extends Event {
    domain: 'server';
    type: EventType;
    session: Session; 
  }

  export function userConnected(session: Session): UserEvent {
    return {
      domain: 'server',
      type: 'user_connected',
      timestamp: Date.now(),
      session
    }
  }

  export function userDisconnected(session: Session): UserEvent {
    return {
      domain: 'server',
      type: 'user_disconnected',
      timestamp: Date.now(),
      session
    }
  }
}

export namespace GameEvents {
  export type EventType = 'game_created' | 'game_started' | 'game_state_change';

  export interface GameEvent extends Event {
    domain: 'game';
    type: EventType;
    game: Game;
  }

  export interface GameStateChangeEvent extends GameEvent {
    type: 'game_state_change'
  }

  export function stateChange(game: Game): GameStateChangeEvent {
    return {
      domain: 'game',
      type: 'game_state_change',
      timestamp: Date.now(),
      game
    }
  }

  export function isStateChange(event: Event): event is GameStateChangeEvent {
    return event.domain === 'game' && event.type === 'game_state_change'
  }
}

export namespace PlayerEvents {
  export type EventType = 'set_word' | 'submit_guess'

  export interface PlayerEvent extends Event {
    domain: 'player';
    type: EventType;
    player: Player;
    word: string; 
  }

  export function setWord(player: Player, word: string): PlayerEvent {
    return {
      domain: 'player',
      type: 'set_word',
      timestamp: Date.now(),
      player,
      word
    }
  }

  export function submitGuess(player: Player, word: string): PlayerEvent {
    return {
      domain: 'player',
      type: 'submit_guess',
      timestamp: Date.now(),
      player,
      word
    }
  }

  export function isSetWord(event: Event): event is PlayerEvent {
    return event.domain === 'player' && event.type === 'set_word'
  }
}

// guards

export function isUserEvent(event: Event): event is UserEvents.UserEvent {
  return event.domain == 'server' && (
    event.type == 'user_connected' ||
    event.type == 'user_disconnected'
  )
}

export function isGameEvent(event: Event): event is GameEvents.GameEvent {
  return event.domain == 'game'
}

export function isPlayerEvent(event: Event): event is PlayerEvents.PlayerEvent {
  return event.domain == 'player'
}