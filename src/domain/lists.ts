/**
 * Typed list access. With `noUncheckedIndexedAccess` on, `list[i]` may be
 * undefined; these say what the code knows instead of asserting it away.
 */

/** A list with at least one item, so its first is always there. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** `list`, checked to have at least one item; throws, naming `what`, when it is empty. */
export function nonEmpty<T>(list: readonly T[], what: string): NonEmpty<T> {
  const [first, ...rest] = list;
  if (list.length === 0) throw new RangeError(`${what} is empty`);
  return [first as T, ...rest];
}

/**
 * The item at `index` (negative counts from the end), which the caller knows
 * is there. Throws rather than letting `undefined` into arithmetic, where it
 * would surface far away as NaN.
 */
export function itemAt<T>(list: readonly T[], index: number): T {
  if (index >= list.length || index < -list.length) {
    throw new RangeError(`index ${index} is outside a list of ${list.length}`);
  }
  return list.at(index) as T;
}
