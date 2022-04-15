import { Event } from './event'
import Player from '../player'
import { Guess } from 'jotto_core';

export namespace PlayerEvents {

  export type EventType =
    | 'set_word'
    | 'submit_guess'

  export interface PlayerEvent extends Event {
    domain: 'player'
    type: EventType
    player: Player
  }

  export interface GuessEvent extends PlayerEvent {
    type: 'submit_guess'
    guess: Guess
  }

  export interface SetWordEvent extends PlayerEvent {
    type: 'set_word'
    word: string
    assigned: boolean
  }

  export function setWord(player: Player, word: string, assigned: boolean = false): SetWordEvent {
    return {
      domain: 'player',
      type: 'set_word',
      timestamp: Date.now(),
      player,
      word,
      assigned
    }
  }

  export function submitGuess(player: Player, guess: Guess): GuessEvent {
    return {
      domain: 'player',
      type: 'submit_guess',
      timestamp: Date.now(),
      player,
      guess
    }
  }

  export function isPlayerEvent(event: Event): event is PlayerEvents.PlayerEvent {
    return event.domain == 'player'
  }

  export function isSetWordEvent(event: Event): event is PlayerEvents.SetWordEvent {
    return isPlayerEvent(event) && event.type === 'set_word'
  }
}