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
 * Get the union of set A and B
 * @param a Set A
 * @param b Set B
 */
 export function union<T>(a: T[], b: T[]): T[] {
  let x = new Set([...a, ...b]);
  return Array.from(x.values());
}

/**
 * Get the size of set X where X = A ∩ B
 * @param a Set A
 * @param b Set B
 */
 export function numIntersect<T>(a: T[], b: T[]): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) {
      n += b.includes(a[i]) ? 1 : 0;
  }

  return n;
}

/**
 * Check an array for duplicates
 * @param items The items to check for duplicates
 */
 export function duplicates<T>(items: T[]): T[] {
  const hash = new Map<T, number>();

  for (let item of items) {
    hash.set(item, (hash.get(item) ?? 0) + 1);
  }

  let dups: T[] = [];
  hash.forEach((num, item) => {
    if (num > 1) dups.push(item);
  });

  return dups;
}

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