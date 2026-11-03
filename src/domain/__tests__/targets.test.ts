import { describe, expect, it } from 'vitest';

import { centsBetween, midiToFrequency } from '../pitch';
import { STRING_CAPTURE_CENTS, candidateStrings, nearestString, resolveTarget, type TargetContext } from '../targets';

const GUITAR = [40, 45, 50, 55, 59, 64];
const DROP_C = [36, 43, 48, 53, 57, 62];

function context(overrides: Partial<TargetContext> = {}): TargetContext {
  return { notes: GUITAR, a4: 440, locked: null, current: null, ...overrides };
}

/** `cents` above `midi`, in Hz. */
const above = (midi: number, cents: number) => midiToFrequency(midi) * Math.pow(2, cents / 1200);

describe('resolveTarget', () => {
  it('aims at the nearest string', () => {
    expect(resolveTarget(110, context())).toEqual({ stringIndex: 1, midi: 45 });
    expect(resolveTarget(above(50, -30), context())).toEqual({ stringIndex: 2, midi: 50 });
  });

  it('follows the reference pitch', () => {
    const a442 = midiToFrequency(45, 442);
    const target = resolveTarget(a442, context({ a4: 442 }));
    expect(target.stringIndex).toBe(1);
    expect(centsBetween(a442, midiToFrequency(target.midi, 442))).toBeCloseTo(0, 6);
  });

  it('reads chromatically far from every string', () => {
    expect(resolveTarget(1000, context())).toEqual({ stringIndex: null, midi: 83 });
  });

  it('stays on a locked string however far off the pitch is', () => {
    // An E2, heard while the low string is meant to be at drop C: four semitones sharp.
    const e2 = midiToFrequency(40);
    expect(resolveTarget(e2, context({ notes: DROP_C, locked: 0 }))).toEqual({ stringIndex: 0, midi: 36 });
    expect(resolveTarget(e2, context({ notes: DROP_C, locked: 0, current: 1 })).stringIndex).toBe(0);
  });

  it('ignores a lock that is not a string of the tuning', () => {
    expect(resolveTarget(110, context({ locked: 9 })).stringIndex).toBe(1);
  });
});

describe('nearestString hysteresis', () => {
  // E2 and A2 are 500 cents apart; 260 above E2 is 20 cents nearer A2.
  const justPastMidway = above(40, 260);

  it('switches to the nearer string with nothing to hold', () => {
    expect(nearestString(justPastMidway, context())).toBe(1);
  });

  it('holds the current string until another is clearly closer', () => {
    expect(nearestString(justPastMidway, context({ current: 0 }))).toBe(0);
    expect(nearestString(above(40, 300), context({ current: 0 }))).toBe(1);
  });

  it('captures nothing beyond the capture range', () => {
    expect(nearestString(above(64, STRING_CAPTURE_CENTS + 10), context())).toBeNull();
    expect(nearestString(above(64, STRING_CAPTURE_CENTS - 10), context())).toBe(5);
  });
});

describe('candidateStrings', () => {
  const QOTSA = [43, 43, 50, 55, 62, 62];

  it('is the string itself when no other shares its note', () => {
    expect(candidateStrings(GUITAR, 2, null)).toEqual([2]);
    expect(candidateStrings(QOTSA, 3, null)).toEqual([3]);
  });

  it('is the whole unison pair while following any string', () => {
    expect(candidateStrings(QOTSA, 0, null)).toEqual([0, 1]);
    expect(candidateStrings(QOTSA, 5, null)).toEqual([4, 5]);
  });

  it('is only the locked string while one is locked', () => {
    expect(candidateStrings(QOTSA, 1, 1)).toEqual([1]);
  });

  it('is nothing for a string the tuning does not have', () => {
    expect(candidateStrings(QOTSA, 6, null)).toEqual([]);
  });
});
