import { Event } from './event'
import Player from '../player'
import { Guess } from 'jotto_core';

export namespace PlayerEvents {

  export type EventType =
    | 'set_word'
    | 'submit_guess'

  export interface PlayerEvent extends Event {
    domain: 'player';
    type: EventType;
    player: Player;
  }

  export interface GuessEvent extends PlayerEvent {
    type: 'submit_guess'
    guess: Guess
  }

  export function setWord(player: Player): PlayerEvent {
    return {
      domain: 'player',
      type: 'set_word',
      timestamp: Date.now(),
      player
    }
  }

  export function submitGuess(player: Player, guess: Guess ): GuessEvent {
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
}