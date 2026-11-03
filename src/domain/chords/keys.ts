/**
 * Keys, for the chord book's key filter: the twelve major and twelve minor
 * keys, and the chords each one is built from.
 *
 * A minor key is its natural minor plus the major V that nearly every song in
 * a minor key uses (E and E7 in A minor), since leaving it out would make the
 * filter hide the chord a player is most likely looking for.
 */

import { toPitchClass, type Spelling } from '../pitch';
import type { ChordRef, ChordTypeId } from './chordTypes';
import { keyTonicSpelling, letterAbove, naturalPitchClass, plainSpelling, spellingName, toAccidental, type NoteSpelling } from './spelling';

export type KeyMode = 'major' | 'minor';

export interface MusicalKey {
  tonic: number;
  mode: KeyMode;
}

/** Stored in settings: `9-minor`. */
export type KeyId = `${number}-${KeyMode}`;

export function keyId({ tonic, mode }: MusicalKey): KeyId {
  return `${toPitchClass(tonic)}-${mode}`;
}

export function parseKeyId(id: unknown): MusicalKey | null {
  if (typeof id !== 'string') return null;
  const match = /^(\d{1,2})-(major|minor)$/.exec(id);
  if (!match) return null;
  const tonic = Number(match[1]);
  if (tonic > 11) return null;
  return { tonic, mode: match[2] as KeyMode };
}

/** Every key, majors then minors, each from C. */
export const KEYS: readonly MusicalKey[] = (['major', 'minor'] as const).flatMap((mode) =>
  Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode })));

export function keyName(key: MusicalKey, tie: Spelling): string {
  return `${spellingName(keyTonicSpelling(key.tonic, key.mode, tie))} ${key.mode}`;
}

/** A chord of the key, with its degree as a Roman numeral. */
export interface KeyChord extends ChordRef {
  degree: string;
  /** The root as the key spells it: E♯ in C♯ major, not F. */
  spelling: NoteSpelling;
}

type DegreeChord = readonly [semitones: number, type: ChordTypeId, degree: string];

const MAJOR_TRIADS: readonly DegreeChord[] = [
  [0, 'maj', 'I'], [2, 'm', 'ii'], [4, 'm', 'iii'], [5, 'maj', 'IV'], [7, 'maj', 'V'], [9, 'm', 'vi'], [11, 'dim', 'vii°'],
];
/** No vii: its seventh is half-diminished (m7♭5), not one of the book's types. */
const MAJOR_SEVENTHS: readonly DegreeChord[] = [
  [0, 'maj7', 'Imaj7'], [2, 'm7', 'ii7'], [4, 'm7', 'iii7'], [5, 'maj7', 'IVmaj7'], [7, '7', 'V7'], [9, 'm7', 'vi7'],
];
const MINOR_TRIADS: readonly DegreeChord[] = [
  [0, 'm', 'i'], [2, 'dim', 'ii°'], [3, 'maj', 'III'], [5, 'm', 'iv'], [7, 'm', 'v'], [7, 'maj', 'V'], [8, 'maj', 'VI'], [10, 'maj', 'VII'],
];
/** No ii: half-diminished again. */
const MINOR_SEVENTHS: readonly DegreeChord[] = [
  [0, 'm7', 'i7'], [3, 'maj7', 'IIImaj7'], [5, 'm7', 'iv7'], [7, 'm7', 'v7'], [7, '7', 'V7'], [8, 'maj7', 'VImaj7'], [10, '7', 'VII7'],
];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

/** The key's note on a scale step, spelt on the step's own letter. */
function degreeSpelling(key: MusicalKey, semitones: number, tie: Spelling): NoteSpelling {
  const tonic = keyTonicSpelling(key.tonic, key.mode, tie);
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const letter = letterAbove(tonic.letter, steps.indexOf(semitones));
  const accidental = toAccidental(toPitchClass(key.tonic + semitones - naturalPitchClass(letter) + 6) - 6);
  // Every key on the list spells its degrees with single accidentals; plain is a safe floor.
  return accidental === null ? plainSpelling(key.tonic + semitones, tie) : { letter, accidental };
}

/** The key's chords: its triads in degree order, then its sevenths. */
export function keyChords(key: MusicalKey, tie: Spelling): KeyChord[] {
  const chords = key.mode === 'major' ? [...MAJOR_TRIADS, ...MAJOR_SEVENTHS] : [...MINOR_TRIADS, ...MINOR_SEVENTHS];
  return chords.map(([semitones, type, degree]) => ({
    root: toPitchClass(key.tonic + semitones),
    type,
    degree,
    spelling: degreeSpelling(key, semitones, tie),
  }));
}

/** Where a chord sits in the key, or null when it is not one of the key's chords. */
export function chordInKey(key: MusicalKey, chord: ChordRef, tie: Spelling): KeyChord | null {
  const pc = toPitchClass(chord.root);
  return keyChords(key, tie).find((entry) => entry.root === pc && entry.type === chord.type) ?? null;
}
