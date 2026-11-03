/**
 * A chord shape: where each string is stopped, and with which finger.
 *
 * Frets count up from the nut, or from the capo when there is one: 0 is the
 * open string, null a string left out. On the cello, which has no frets, a
 * "fret" is the semitone a finger stops above the open string, the same
 * number a fretted instrument would use.
 */

import { itemAt } from '../lists';
import { toPitchClass } from '../pitch';
import { requiredPitchClasses, chordPitchClasses, type ChordRef } from './chordTypes';

/** 0 is an open string; 1–4 index to little finger. */
export type Finger = 0 | 1 | 2 | 3 | 4;

/** Where a shape comes from, which is what its label says. */
export type ShapeSource =
  /** An open-position shape learnt as `learnt` in standard tuning. */
  | { kind: 'open'; learnt: ChordRef }
  /** A movable barre: the E or A shape with its root at `fret`. */
  | { kind: 'barre'; form: 'E' | 'A'; fret: number; lowString?: boolean }
  /** A drop tuning's power chord: one finger across the three lowest strings. */
  | { kind: 'one-finger'; fret: number }
  /** Found by searching the tuning. */
  | { kind: 'found' };

export interface ChordShape {
  /** Lowest string first. */
  frets: readonly (number | null)[];
  fingers: readonly (Finger | null)[];
  source: ShapeSource;
}

/** The sounding MIDI note of every string, null where the string is left out. */
export function soundingNotes(frets: readonly (number | null)[], open: readonly number[]): (number | null)[] {
  return frets.map((fret, string) => (fret === null ? null : itemAt(open, string) + fret));
}

/** True when every note is in the chord and every tone it needs is there. */
export function soundsChord(frets: readonly (number | null)[], open: readonly number[], chord: ChordRef): boolean {
  const sounding = soundingNotes(frets, open).filter((note): note is number => note !== null).map(toPitchClass);
  if (sounding.length < 2) return false;
  const allowed = new Set(chordPitchClasses(chord.root, chord.type));
  const present = new Set(sounding);
  return sounding.every((pc) => allowed.has(pc))
    && requiredPitchClasses(chord.root, chord.type).every((pc) => present.has(pc));
}

/** The pitch class of the lowest note sounded. */
export function bassPitchClass(frets: readonly (number | null)[], open: readonly number[]): number | null {
  const lowest = soundingNotes(frets, open).find((note) => note !== null);
  return lowest === undefined ? null : toPitchClass(lowest);
}

/** Lowest and highest stopped fret (open strings excluded), or null when nothing is stopped. */
export function stoppedRange(frets: readonly (number | null)[]): { low: number; high: number } | null {
  const stopped = frets.filter((fret): fret is number => fret !== null && fret > 0);
  if (stopped.length === 0) return null;
  return { low: Math.min(...stopped), high: Math.max(...stopped) };
}

// ─── Fingering ───────────────────────────────────────────────────────────────

/** Frets one hand covers: index on the first, little finger three frets up. */
export const HAND_SPAN = 3;

interface Stop {
  string: number;
  fret: number;
}

/** One finger's job: a single stop, or several on one fret on neighbouring strings. */
interface Slot {
  fret: number;
  strings: number[];
}

function bySlotOrder(a: Slot, b: Slot): number {
  return a.fret - b.fret || itemAt(a.strings, 0) - itemAt(b.strings, 0);
}

/**
 * Fingers 2–4 (or 1–4) for these slots in fret order, each at least as far
 * from the index as its fret is from the lowest fret. Null when four fingers
 * cannot reach.
 */
function fingerSlots(slots: readonly Slot[], first: number, lowest: number): number[] | null {
  const fingers: number[] = [];
  let previous = first - 1;
  for (const slot of slots) {
    const finger = Math.max(previous + 1, slot.fret - lowest + 1);
    if (finger > 4) return null;
    fingers.push(finger);
    previous = finger;
  }
  return fingers;
}

/** Merge same-fret stops on adjacent strings into one finger's slot, highest fret first. */
function mergeNeighbours(slots: readonly Slot[], frets: readonly (number | null)[]): Slot[] {
  const merged: Slot[] = [];
  for (const slot of [...slots].sort((a, b) => b.fret - a.fret || itemAt(a.strings, 0) - itemAt(b.strings, 0))) {
    const last = merged.at(-1);
    const next = itemAt(slot.strings, 0);
    if (last?.fret === slot.fret && next === itemAt(last.strings, -1) + 1 && frets[next] === slot.fret) last.strings.push(next);
    else merged.push({ fret: slot.fret, strings: [...slot.strings] });
  }
  return merged.sort(bySlotOrder);
}

function writeFingers(frets: readonly (number | null)[], slots: readonly Slot[], fingers: readonly number[]): (Finger | null)[] {
  const result: (Finger | null)[] = frets.map((fret) => (fret === null ? null : 0));
  slots.forEach((slot, index) => slot.strings.forEach((string) => { result[string] = fingers[index] as Finger; }));
  return result;
}

/** Fit the slots to the fingers left, merging neighbours on one fret if there are too many. */
function fitSlots(slots: Slot[], frets: readonly (number | null)[], first: number, lowest: number): { slots: Slot[]; fingers: number[] } | null {
  const direct = fingerSlots(slots, first, lowest);
  if (direct) return { slots, fingers: direct };
  const merged = mergeNeighbours(slots, frets);
  const fingers = fingerSlots(merged, first, lowest);
  return fingers ? { slots: merged, fingers } : null;
}

/**
 * The index finger laid across every string from the lowest stop on the
 * lowest fret to the highest, which works only if nothing in between is open
 * or left out.
 */
function indexBarre(stops: readonly Stop[], frets: readonly (number | null)[], lowest: number): Slot | null {
  const onLowest = stops.filter((stop) => stop.fret === lowest).map((stop) => stop.string);
  const from = Math.min(...onLowest);
  const to = Math.max(...onLowest);
  for (let string = from; string <= to; string++) {
    const fret = frets[string];
    if (fret === null || fret === undefined || fret < lowest) return null;
  }
  return { fret: lowest, strings: onLowest };
}

/**
 * A plausible fingering for a fret pattern, or null when one hand cannot play
 * it: more than four frets apart, or more stops than fingers even with a
 * barre. Used for shapes the app adapts or finds; the shapes players learn by
 * heart carry their own, conventional fingering.
 */
export function fingerShape(frets: readonly (number | null)[], span = HAND_SPAN): (Finger | null)[] | null {
  const stops: Stop[] = frets.flatMap((fret, string) => (fret === null || fret === 0 ? [] : [{ string, fret }]));
  if (stops.length === 0) return frets.map((fret) => (fret === null ? null : 0));
  const lowest = Math.min(...stops.map((stop) => stop.fret));
  const highest = Math.max(...stops.map((stop) => stop.fret));
  if (highest - lowest > span) return null;

  const singles: Slot[] = stops.map((stop) => ({ fret: stop.fret, strings: [stop.string] })).sort(bySlotOrder);
  const barre = indexBarre(stops, frets, lowest);
  // Three or more strings on one fret and nothing else: one finger across them.
  const oneFinger = barre !== null && barre.strings.length >= 3 && stops.length === barre.strings.length;
  if (!oneFinger) {
    const plain = fingerSlots(singles, 1, lowest);
    if (plain) return writeFingers(frets, singles, plain);
  }
  if (!barre) return null;
  const rest = singles.filter((slot) => slot.fret !== lowest);
  const fitted = fitSlots(rest, frets, 2, lowest);
  if (!fitted) return null;
  return writeFingers(frets, [barre, ...fitted.slots], [1, ...fitted.fingers]);
}

/** Fingers that hold more than one string, and the fret they lie on: barres to draw. */
export function barresOf(shape: Pick<ChordShape, 'frets' | 'fingers'>): { finger: Finger; fret: number; from: number; to: number }[] {
  const groups = new Map<string, { finger: Finger; fret: number; from: number; to: number }>();
  shape.fingers.forEach((finger, string) => {
    const fret = shape.frets[string];
    if (finger === null || finger === 0 || fret === null || fret === undefined || fret === 0) return;
    const key = `${finger}:${fret}`;
    const group = groups.get(key);
    if (group) {
      group.from = Math.min(group.from, string);
      group.to = Math.max(group.to, string);
    } else {
      groups.set(key, { finger, fret, from: string, to: string });
    }
  });
  return [...groups.values()].filter((group) => group.to > group.from);
}
