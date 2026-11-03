/**
 * The shapes guitarists learn, in standard tuning (E A D G B E): the open
 * chords, and the two movable barres every chord chart assumes, the E shape
 * (root on the sixth string) and the A shape (root on the fifth).
 *
 * Written out by hand, with the fingering a teacher would show, because these
 * are remembered shapes rather than whatever a search ranks first. Every one
 * is checked against the chord it claims to be in `chords.test.ts`.
 *
 * Frets and fingers run lowest string first; null is a string left out.
 */

import { toPitchClass } from '../pitch';
import type { ChordTypeId } from './chordTypes';
import { soundsChord, type ChordShape, type Finger } from './shapes';

type Frets = readonly (number | null)[];
type Fingers = readonly (Finger | null)[];

interface OpenShape {
  root: number;
  frets: Frets;
  fingers: Fingers;
}

interface Movable {
  /** Frets above the root's fret. */
  offsets: Frets;
  fingers: Fingers;
}

const x = null;
const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11;

/** Open chords: the root's pitch class, frets, fingers. */
const OPEN: Record<ChordTypeId, readonly OpenShape[]> = {
  maj: [
    { root: C, frets: [x, 3, 2, 0, 1, 0], fingers: [x, 3, 2, 0, 1, 0] },
    { root: D, frets: [x, x, 0, 2, 3, 2], fingers: [x, x, 0, 1, 3, 2] },
    { root: E, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    { root: G, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { root: A, frets: [x, 0, 2, 2, 2, 0], fingers: [x, 0, 1, 2, 3, 0] },
  ],
  m: [
    { root: D, frets: [x, x, 0, 2, 3, 1], fingers: [x, x, 0, 2, 3, 1] },
    { root: E, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    { root: A, frets: [x, 0, 2, 2, 1, 0], fingers: [x, 0, 2, 3, 1, 0] },
  ],
  7: [
    { root: C, frets: [x, 3, 2, 3, 1, 0], fingers: [x, 3, 2, 4, 1, 0] },
    { root: D, frets: [x, x, 0, 2, 1, 2], fingers: [x, x, 0, 2, 1, 3] },
    { root: E, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    { root: G, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    { root: A, frets: [x, 0, 2, 0, 2, 0], fingers: [x, 0, 2, 0, 3, 0] },
    { root: B, frets: [x, 2, 1, 2, 0, 2], fingers: [x, 2, 1, 3, 0, 4] },
  ],
  m7: [
    { root: D, frets: [x, x, 0, 2, 1, 1], fingers: [x, x, 0, 2, 1, 1] },
    { root: E, frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
    { root: A, frets: [x, 0, 2, 0, 1, 0], fingers: [x, 0, 2, 0, 1, 0] },
  ],
  maj7: [
    { root: C, frets: [x, 3, 2, 0, 0, 0], fingers: [x, 3, 2, 0, 0, 0] },
    { root: D, frets: [x, x, 0, 2, 2, 2], fingers: [x, x, 0, 1, 1, 1] },
    { root: E, frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    { root: F, frets: [x, x, 3, 2, 1, 0], fingers: [x, x, 3, 2, 1, 0] },
    { root: G, frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
    { root: A, frets: [x, 0, 2, 1, 2, 0], fingers: [x, 0, 2, 1, 3, 0] },
  ],
  sus2: [
    { root: D, frets: [x, x, 0, 2, 3, 0], fingers: [x, x, 0, 1, 3, 0] },
    { root: E, frets: [0, 2, 4, 4, 0, 0], fingers: [0, 1, 3, 4, 0, 0] },
    { root: A, frets: [x, 0, 2, 2, 0, 0], fingers: [x, 0, 1, 2, 0, 0] },
  ],
  sus4: [
    { root: C, frets: [x, 3, 3, 0, 1, 1], fingers: [x, 3, 4, 0, 1, 1] },
    { root: D, frets: [x, x, 0, 2, 3, 3], fingers: [x, x, 0, 1, 3, 4] },
    { root: E, frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
    { root: G, frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
    { root: A, frets: [x, 0, 2, 2, 3, 0], fingers: [x, 0, 1, 2, 3, 0] },
  ],
  5: [
    { root: D, frets: [x, x, 0, 2, 3, x], fingers: [x, x, 0, 1, 3, x] },
    { root: E, frets: [0, 2, 2, x, x, x], fingers: [0, 1, 2, x, x, x] },
    { root: A, frets: [x, 0, 2, 2, x, x], fingers: [x, 0, 1, 2, x, x] },
  ],
  dim: [
    { root: D, frets: [x, x, 0, 1, 3, 1], fingers: [x, x, 0, 1, 3, 2] },
  ],
  aug: [
    { root: C, frets: [x, 3, 2, 1, 1, 0], fingers: [x, 4, 3, 1, 2, 0] },
    { root: E, frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
  ],
};

/** The E shape: root on the sixth string, barred with the index finger. */
const E_SHAPE: Partial<Record<ChordTypeId, Movable>> = {
  maj: { offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
  m: { offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
  7: { offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1] },
  m7: { offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1] },
  maj7: { offsets: [0, x, 1, 1, 0, x], fingers: [2, x, 3, 4, 1, x] },
  sus4: { offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1] },
  5: { offsets: [0, 2, 2, x, x, x], fingers: [1, 3, 4, x, x, x] },
  dim: { offsets: [0, 1, 2, 0, x, x], fingers: [1, 2, 3, 1, x, x] },
  aug: { offsets: [0, x, 2, 1, 1, x], fingers: [1, x, 4, 2, 3, x] },
  // No sus2: the E shape's would span five frets.
};

/** The A shape: root on the fifth string. */
const A_SHAPE: Partial<Record<ChordTypeId, Movable>> = {
  maj: { offsets: [x, 0, 2, 2, 2, 0], fingers: [x, 1, 3, 3, 3, 1] },
  m: { offsets: [x, 0, 2, 2, 1, 0], fingers: [x, 1, 3, 4, 2, 1] },
  7: { offsets: [x, 0, 2, 0, 2, 0], fingers: [x, 1, 3, 1, 4, 1] },
  m7: { offsets: [x, 0, 2, 0, 1, 0], fingers: [x, 1, 3, 1, 2, 1] },
  maj7: { offsets: [x, 0, 2, 1, 2, 0], fingers: [x, 1, 3, 2, 4, 1] },
  sus2: { offsets: [x, 0, 2, 2, 0, 0], fingers: [x, 1, 3, 4, 1, 1] },
  sus4: { offsets: [x, 0, 2, 2, 3, 0], fingers: [x, 1, 2, 3, 4, 1] },
  5: { offsets: [x, 0, 2, 2, x, x], fingers: [x, 1, 3, 4, x, x] },
  dim: { offsets: [x, 0, 1, 2, 1, x], fingers: [x, 1, 2, 4, 3, x] },
  aug: { offsets: [x, 0, 3, 2, 2, x], fingers: [x, 1, 4, 2, 3, x] },
};

/** Highest fret a barre's root is placed at: the twelfth would be the open shape an octave up. */
const MAX_BARRE_FRET = 11;

/** B1 E2 A2 D3 G3 B3 E4, as MIDI: the seven-string's standard tuning. */
const SEVEN_STRING_STANDARD = [35, 40, 45, 50, 55, 59, 64];

function place(movable: Movable, fret: number): Pick<ChordShape, 'frets' | 'fingers'> {
  return { frets: movable.offsets.map((offset) => (offset === null ? null : offset + fret)), fingers: movable.fingers };
}

/** The movable shape with its root on `openPitchClass`'s string, or null when that lands on the nut. */
function barre(movable: Movable | undefined, openPitchClass: number, root: number, form: 'E' | 'A'): ChordShape | null {
  if (!movable) return null;
  const fret = toPitchClass(root - openPitchClass);
  // Fret 0 is the open chord, listed on its own with an open fingering.
  if (fret === 0 || fret > MAX_BARRE_FRET) return null;
  return { ...place(movable, fret), source: { kind: 'barre', form, fret } };
}

/**
 * A chord's shapes on a six-string guitar in standard tuning: its open shape
 * where it has one, then the E and A shapes, lowest first.
 */
export function guitarShapes(root: number, type: ChordTypeId): ChordShape[] {
  const pc = toPitchClass(root);
  const open: ChordShape[] = OPEN[type]
    .filter((shape) => shape.root === pc)
    .map((shape) => ({ frets: shape.frets, fingers: shape.fingers, source: { kind: 'open', learnt: { root: pc, type } } }));
  const barres = [barre(E_SHAPE[type], E, pc, 'E'), barre(A_SHAPE[type], A, pc, 'A')]
    .filter((shape): shape is ChordShape => shape !== null)
    .sort((a, b) => (a.source.kind === 'barre' && b.source.kind === 'barre' ? a.source.fret - b.source.fret : 0));
  return [...open, ...barres];
}

/**
 * A seven-string's shapes: the six-string ones on its upper six strings, then
 * the E shape moved down onto strings 7–4 (B E A D are fourths apart, as E A
 * D G are), where its lower four notes still make the chord.
 */
export function sevenStringShapes(root: number, type: ChordTypeId): ChordShape[] {
  const upper = guitarShapes(root, type).map((shape) => ({
    ...shape, frets: [null, ...shape.frets], fingers: [null, ...shape.fingers],
  }));
  const movable = E_SHAPE[type];
  const fret = toPitchClass(root - B);
  if (!movable || fret === 0 || fret > MAX_BARRE_FRET) return upper;
  const low = place({ offsets: movable.offsets.slice(0, 4), fingers: movable.fingers.slice(0, 4) }, fret);
  const frets = [...low.frets, null, null, null];
  // The augmented E shape keeps its sharp fifth on the second string, which is not among the four.
  if (!soundsChord(frets, SEVEN_STRING_STANDARD, { root, type })) return upper;
  return [...upper, {
    frets,
    fingers: [...low.fingers, null, null, null],
    source: { kind: 'barre', form: 'E', fret, lowString: true },
  }];
}
