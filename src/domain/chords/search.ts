/**
 * Finding chord shapes by search, for every instrument and tuning that has no
 * shapes learnt by heart: the bass, the cello, and the guitar's open and
 * alternate tunings.
 *
 * Exhaustive within a hand's reach, then ranked: the root in the bass, more
 * strings, lower on the neck, fewer fingers. Only shapes that sound every tone
 * the chord needs, and nothing outside it, are kept.
 */

import { itemAt } from '../lists';
import { toPitchClass } from '../pitch';
import { chordPitchClasses, requiredPitchClasses, type ChordRef } from './chordTypes';
import {
  bassPitchClass, barresOf, fingerShape, HAND_SPAN, soundsChord, stoppedRange,
  type ChordShape, type Finger,
} from './shapes';

/** Shapes kept per chord. */
export const MAX_SHAPES = 4;
/** The search stays below the twelfth fret: past the octave every shape repeats. */
export const MAX_SEARCH_FRET = 12;

export type SearchStyle = 'strummed' | 'bass' | 'bowed';

interface Candidate {
  frets: (number | null)[];
  fingers: (Finger | null)[];
  cost: number;
}

/** Fewest strings a shape may sound and still be a chord on this instrument. */
function minStrings(chord: ChordRef, style: SearchStyle): number {
  const required = requiredPitchClasses(chord.root, chord.type).length;
  if (chord.type === '5') return 2;
  return style === 'strummed' ? Math.max(required, 4) : Math.max(required, 3);
}

/**
 * What the lowest note costs: nothing for the root; a little for the fifth,
 * which a strummed open tuning sounds by design (open G's low D); more for
 * anything else, which turns the chord into an inversion.
 */
function bassCost(bass: number | null, chord: ChordRef, style: SearchStyle): number {
  if (bass === null) return 0;
  const fromRoot = toPitchClass(bass - chord.root);
  if (fromRoot === 0) return 0;
  if (fromRoot === 7) return style === 'strummed' ? 3 : 6;
  return 12;
}

/** Lower is better. */
function cost(frets: readonly (number | null)[], fingers: readonly (Finger | null)[], open: readonly number[], chord: ChordRef, style: SearchStyle): number {
  const sounded = frets.filter((fret) => fret !== null).length;
  const opens = frets.filter((fret) => fret === 0).length;
  const range = stoppedRange(frets);
  const fingersUsed = new Set(fingers.filter((finger) => finger !== null && finger !== 0)).size;
  let total = 0;
  total += bassCost(bassPitchClass(frets, open), chord, style);
  total += (frets.length - sounded) * (style === 'strummed' ? 2.5 : 1);
  total += (range?.low ?? 0) * 0.8;
  total += range ? (range.high - range.low) * 1.2 : 0;
  total += fingersUsed * 0.5;
  total += barresOf({ frets, fingers }).length * 2;
  total -= opens * (style === 'strummed' ? 0.6 : 0.3);
  return total;
}

/** Strings whose frets differ, a left-out string counting as a difference. */
function difference(a: readonly (number | null)[], b: readonly (number | null)[]): number {
  return a.reduce<number>((count, fret, string) => count + (fret === b[string] ? 0 : 1), 0);
}

/** Where the hand sits: its lowest stop, or the nut for an open-strings shape. */
function position(frets: readonly (number | null)[]): number {
  return stoppedRange(frets)?.low ?? 0;
}

/**
 * Two shapes are worth listing apart when they sit in different places on
 * the neck, or are clearly different grips in the same place; not when one is
 * the other with a string or two changed.
 */
function distinct(a: readonly (number | null)[], b: readonly (number | null)[]): boolean {
  return Math.abs(position(a) - position(b)) >= 3 ? difference(a, b) >= 2 : difference(a, b) >= 4;
}

/** The best few, each distinct from those before it. */
function pickDistinct(candidates: Candidate[]): ChordShape[] {
  const chosen: Candidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => a.cost - b.cost || a.frets.join().localeCompare(b.frets.join()))) {
    if (chosen.every((shape) => distinct(shape.frets, candidate.frets))) chosen.push(candidate);
    if (chosen.length === MAX_SHAPES) break;
  }
  return chosen.map(({ frets, fingers }) => ({ frets, fingers, source: { kind: 'found' } }));
}

/**
 * Every pick of one choice per string in which the sounded strings form one
 * unbroken run, as they do when strummed, plucked or bowed together.
 */
function eachRun<T>(choices: readonly (readonly T[])[], sounded: (choice: T) => boolean, leaf: (picked: readonly T[]) => void): void {
  const picked: T[] = [];
  const visit = (string: number, started: boolean, ended: boolean) => {
    if (string === choices.length) {
      leaf(picked);
      return;
    }
    for (const choice of itemAt(choices, string)) {
      const sounds = sounded(choice);
      if (sounds && ended) continue;
      picked.push(choice);
      visit(string + 1, started || sounds, ended || (started && !sounds));
      picked.pop();
    }
  };
  visit(0, false, false);
}

/** Keeps the cheaper of two candidates with the same frets. */
function keep(found: Map<string, Candidate>, candidate: Candidate): void {
  const key = candidate.frets.join();
  const previous = found.get(key);
  if (!previous || candidate.cost < previous.cost) found.set(key, candidate);
}

/** A complete pick on a fretted instrument, scored, or null when it is no chord or no hand can play it. */
function frettedCandidate(frets: readonly (number | null)[], open: readonly number[], chord: ChordRef, base: number, style: SearchStyle): Candidate | null {
  const sounded = frets.filter((fret) => fret !== null).length;
  const range = stoppedRange(frets);
  // Each shape belongs to the window of its lowest stop; open-only shapes to the first.
  const home = range ? range.low === base : base === 1;
  if (sounded < minStrings(chord, style) || !home || !soundsChord(frets, open, chord)) return null;
  const fingers = fingerShape(frets);
  return fingers ? { frets: [...frets], fingers, cost: cost(frets, fingers, open, chord, style) } : null;
}

/** Every shape with the index finger on `base`, the hand reaching HAND_SPAN frets above it. */
function searchWindow(open: readonly number[], chord: ChordRef, base: number, style: SearchStyle, found: Map<string, Candidate>): void {
  const tones = new Set(chordPitchClasses(chord.root, chord.type));
  const choices = open.map((note) => {
    const options: (number | null)[] = [null];
    if (tones.has(toPitchClass(note))) options.push(0);
    for (let fret = base; fret <= Math.min(base + HAND_SPAN, MAX_SEARCH_FRET); fret++) {
      if (tones.has(toPitchClass(note + fret))) options.push(fret);
    }
    return options;
  });
  eachRun(choices, (fret) => fret !== null, (frets) => {
    const candidate = frettedCandidate(frets, open, chord, base, style);
    if (candidate) keep(found, candidate);
  });
}

/** Shapes for a fretted instrument (guitar or bass) in any tuning, best first. */
export function searchFretted(open: readonly number[], chord: ChordRef, style: Exclude<SearchStyle, 'bowed'>): ChordShape[] {
  const found = new Map<string, Candidate>();
  for (let base = 1; base <= MAX_SEARCH_FRET; base++) searchWindow(open, chord, base, style, found);
  return pickDistinct([...found.values()]);
}

// ─── Cello ───────────────────────────────────────────────────────────────────

/**
 * The cellist's left hand, as Ponticello models it: the first finger at an
 * "anchor" (semitones above the nut) and the others a semitone apart (closed)
 * or with a whole tone between first and second (extended). Half position
 * through fourth.
 */
const MAX_ANCHOR = 7;
const FRAMES = {
  closed: [0, 1, 2, 3],
  extended: [0, 2, 3, 4],
} as const;
/** First position is the study home; half position costs a little; higher costs by distance. */
const ANCHOR_COST: Readonly<Record<number, number>> = { 1: 3, 2: 0 };

function celloCost(frets: readonly (number | null)[], fingers: readonly (Finger | null)[], anchor: number, frame: keyof typeof FRAMES, open: readonly number[], chord: ChordRef): number {
  const stopped = frets.filter((fret) => fret !== null && fret > 0).length;
  const sounded = frets.filter((fret) => fret !== null).length;
  const distinctFingers = new Set(fingers.filter((finger) => finger !== null && finger !== 0)).size;
  const rootInBass = bassPitchClass(frets, open) === toPitchClass(chord.root);
  return (ANCHOR_COST[anchor] ?? anchor * 2) + stopped * 3 + (frame === 'extended' ? 5 : 0)
    + (distinctFingers < stopped ? 4 : 0) + (rootInBass ? 0 : 6) - sounded;
}

interface CelloStop { fret: number | null; finger: Finger | null }

/** A finger may stop two neighbouring strings (a fifth across them), never more. */
function fingersFit(fingers: readonly (Finger | null)[]): boolean {
  return ([1, 2, 3, 4] as const).every((finger) => {
    const seats = fingers.flatMap((f, i) => (f === finger ? [i] : []));
    return seats.length < 2 || (seats.length === 2 && itemAt(seats, 1) - itemAt(seats, 0) === 1);
  });
}

/** One hand frame: every run of strings, each open, left out or under one of its fingers. */
function searchCelloFrame(open: readonly number[], chord: ChordRef, anchor: number, frame: keyof typeof FRAMES, found: Map<string, Candidate>): void {
  const tones = new Set(chordPitchClasses(chord.root, chord.type));
  const fewest = minStrings(chord, 'bowed');
  const choices = open.map((note) => {
    const options: CelloStop[] = [{ fret: null, finger: null }];
    if (tones.has(toPitchClass(note))) options.push({ fret: 0, finger: 0 });
    FRAMES[frame].forEach((offset, index) => {
      if (tones.has(toPitchClass(note + anchor + offset))) options.push({ fret: anchor + offset, finger: (index + 1) as Finger });
    });
    return options;
  });
  eachRun(choices, (stop) => stop.fret !== null, (picked) => {
    const frets = picked.map((stop) => stop.fret);
    const fingers = picked.map((stop) => stop.finger);
    if (frets.filter((fret) => fret !== null).length < fewest || !soundsChord(frets, open, chord) || !fingersFit(fingers)) return;
    keep(found, { frets, fingers, cost: celloCost(frets, fingers, anchor, frame, open, chord) });
  });
}

/** Shapes for a cello in any tuning: double stops and rolled chords within the lower positions. */
export function searchCello(open: readonly number[], chord: ChordRef): ChordShape[] {
  const found = new Map<string, Candidate>();
  for (let anchor = 1; anchor <= MAX_ANCHOR; anchor++) {
    searchCelloFrame(open, chord, anchor, 'closed', found);
    searchCelloFrame(open, chord, anchor, 'extended', found);
  }
  return pickDistinct([...found.values()]);
}
