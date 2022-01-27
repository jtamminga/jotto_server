import { Session } from 'jotto_core';
import Observer from './observer';
import Player from './player'
import User from './user'

/**
 * Shuffle array in place.
 * Uses Fisher-Yates shuffle algorithm.
 * @param array The array to shuffle
 */
export function shuffle<T>(a: ReadonlyArray<T>): T[] {
  const array = [ ...a ];
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Move items over a certain number of indexes
 * @param items The items to move over
 * @param offset The amount to move the items over by
 * @returns The new array with the items moved over
 */
export function moveOver<T>(items: T[], offset = 1): T[] {
  const arr = [...items];
  for (let i = 0; i < arr.length; i++) {
    arr[i] = items[(i + offset) % arr.length];
  }

  return arr;
}

export function isPlayer(user: User): user is Player {
  return user.type === 'player'
}

export function createUser(user: Session): User {
  if (user.type === 'player') {
    return new Player(user)
  }

  if (user.type === 'observer') {
    return new Observer(user)
  }

  throw new Error('Invalid user type')
}