// Fisher-Yates shuffle
export const shuffle = function(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const union = function(a, b) {
  return [...new Set([...a, ...b])]
}

export function intersectLen(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) {
      n += b.includes(a[i])
  }

  return n
}

export function duplicates(chars: string | any[]) {
  let hash = {}
  for (let char of chars) {
    hash[char] = hash[char] === undefined ? 1 : hash[char] + 1
  }

  let dups = []
  for (let char in hash) {
    if (hash[char] > 1) dups.push(char)
  }

  return dups
}