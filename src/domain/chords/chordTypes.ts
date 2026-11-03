/**
 * The ten chord types the book offers: the triads, the four sevenths players
 * meet on every chart, the two suspensions and the power chord.
 */

import { toPitchClass, type PitchClass } from '../pitch';

export type ChordTypeId = 'maj' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | '5' | 'dim' | 'aug';

/** A chord tone: how far above the root, and which scale degree it is named from. */
export interface ChordInterval {
  semitones: number;
  /** 1 = root, 3 = third, 5 = fifth, 7 = seventh…: the letter it is spelt on. */
  degree: 1 | 2 | 3 | 4 | 5 | 7;
  /** As printed in a dot: `R`, `♭3`, `5`, `♭7`. */
  label: string;
  /** A shape may leave it out and still be the chord: the fifth of a seventh chord. */
  optional?: boolean;
}

export interface ChordType {
  id: ChordTypeId;
  /** Written after the root: `m7` in `Am7`. Empty for a major triad. */
  suffix: string;
  /** The tab label. */
  name: string;
  intervals: readonly ChordInterval[];
}

const R: ChordInterval = { semitones: 0, degree: 1, label: 'R' };
const M2: ChordInterval = { semitones: 2, degree: 2, label: '2' };
const m3: ChordInterval = { semitones: 3, degree: 3, label: '♭3' };
const M3: ChordInterval = { semitones: 4, degree: 3, label: '3' };
const P4: ChordInterval = { semitones: 5, degree: 4, label: '4' };
const d5: ChordInterval = { semitones: 6, degree: 5, label: '♭5' };
const P5: ChordInterval = { semitones: 7, degree: 5, label: '5' };
const A5: ChordInterval = { semitones: 8, degree: 5, label: '♯5' };
const m7: ChordInterval = { semitones: 10, degree: 7, label: '♭7' };
const M7: ChordInterval = { semitones: 11, degree: 7, label: '7' };
/** In a seventh chord the fifth adds the least and is the first note left out. */
const P5_OPTIONAL: ChordInterval = { ...P5, optional: true };

export const CHORD_TYPES: Record<ChordTypeId, ChordType> = {
  maj: { id: 'maj', suffix: '', name: 'Major', intervals: [R, M3, P5] },
  m: { id: 'm', suffix: 'm', name: 'Minor', intervals: [R, m3, P5] },
  7: { id: '7', suffix: '7', name: '7', intervals: [R, M3, P5_OPTIONAL, m7] },
  m7: { id: 'm7', suffix: 'm7', name: 'm7', intervals: [R, m3, P5_OPTIONAL, m7] },
  maj7: { id: 'maj7', suffix: 'maj7', name: 'maj7', intervals: [R, M3, P5_OPTIONAL, M7] },
  sus2: { id: 'sus2', suffix: 'sus2', name: 'sus2', intervals: [R, M2, P5] },
  sus4: { id: 'sus4', suffix: 'sus4', name: 'sus4', intervals: [R, P4, P5] },
  5: { id: '5', suffix: '5', name: '5', intervals: [R, P5] },
  dim: { id: 'dim', suffix: 'dim', name: 'dim', intervals: [R, m3, d5] },
  aug: { id: 'aug', suffix: 'aug', name: 'aug', intervals: [R, M3, A5] },
};

/** The order of the type switch. */
export const CHORD_TYPE_ORDER: readonly ChordTypeId[] = ['maj', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', '5', 'dim', 'aug'];

export function isChordTypeId(value: unknown): value is ChordTypeId {
  return typeof value === 'string' && value in CHORD_TYPES;
}

/** Pitch classes of the chord's tones, root first. */
export function chordPitchClasses(root: number, type: ChordTypeId): PitchClass[] {
  return CHORD_TYPES[type].intervals.map((interval) => toPitchClass(root + interval.semitones));
}

/** Pitch classes a shape must sound to be this chord. */
export function requiredPitchClasses(root: number, type: ChordTypeId): PitchClass[] {
  return CHORD_TYPES[type].intervals
    .filter((interval) => interval.optional !== true)
    .map((interval) => toPitchClass(root + interval.semitones));
}

/** The chord tone a pitch class is, or undefined when it is not in the chord. */
export function intervalOf(root: number, type: ChordTypeId, pitchClass: number): ChordInterval | undefined {
  return CHORD_TYPES[type].intervals.find((interval) => toPitchClass(root + interval.semitones) === toPitchClass(pitchClass));
}

/** A chord in the book: a root pitch class and a type. */
export interface ChordRef {
  root: number;
  type: ChordTypeId;
}

export function chordKey({ root, type }: ChordRef): string {
  return `${toPitchClass(root)}:${type}`;
}
