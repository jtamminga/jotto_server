import Game from '../game'
import { GameState } from '../types'
import { Event } from './event'

export namespace GameEvents {

  export type EventType =
    | 'game_created'
    | 'game_started'
    | 'game_state_change'

  export interface GameEvent extends Event {
    domain: 'game';
    type: EventType;
    game: Game;
  }

  export interface GameStateChangeEvent extends GameEvent {
    type: 'game_state_change'
    state: GameState
  }

  export function stateChange(game: Game): GameStateChangeEvent {
    return {
      domain: 'game',
      type: 'game_state_change',
      timestamp: Date.now(),
      game,
      state: game.state
    }
  }

  export function isStateChangeEvent(event: Event): event is GameStateChangeEvent {
    return event.domain === 'game' && event.type === 'game_state_change'
  }
}