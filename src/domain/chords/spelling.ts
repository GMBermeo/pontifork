/**
 * How a chord and its notes are written.
 *
 * A chord's root is spelt the way a chart spells it: the key with the fewest
 * accidentals (D♭ major, not C♯; C♯ minor, not D♭), and where the two are
 * equally good (F♯ / G♭ major, D♯ / E♭ minor) the tuning's own preference
 * breaks the tie. Its notes are then spelt from the root's letter, so B major
 * is B D♯ F♯ and B♭ major is B♭ D F, never a mixture.
 */

import { toPitchClass, type ByPitchClass, type PitchClass, type Spelling } from '../pitch';
import { CHORD_TYPES, type ChordInterval, type ChordTypeId } from './chordTypes';

/** A note's letter by its place in the scale: 0 = C … 6 = B. */
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_COUNT = LETTERS.length;
const LETTER_BY_NAME = new Map<string, Letter>([['C', 0], ['D', 1], ['E', 2], ['F', 3], ['G', 4], ['A', 5], ['B', 6]]);
const LETTER_PITCH_CLASS = [0, 2, 4, 5, 7, 9, 11] as const;
/** The letter of each natural pitch class; black keys have none. */
const NATURAL_LETTER: Partial<Record<PitchClass, Letter>> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

/** Flat, natural or sharp. */
export type Accidental = -1 | 0 | 1;

const ACCIDENTAL_GLYPH: Record<Accidental, string> = { [-1]: '♭', 0: '', 1: '♯' };

/** A note as written: a letter and an accidental in semitones. */
export interface NoteSpelling {
  letter: Letter;
  accidental: Accidental;
}

/** The letter `steps` letters above `letter`, wrapping from B to C. */
export function letterAbove(letter: Letter, steps: number): Letter {
  // The double remainder lands an integer in 0…6, which is every Letter.
  return (((letter + steps) % LETTER_COUNT) + LETTER_COUNT) % LETTER_COUNT as Letter;
}

/** The pitch class of a letter with no accidental. */
export function naturalPitchClass(letter: Letter): PitchClass {
  return LETTER_PITCH_CLASS[letter];
}

/** `semitones` as an accidental, or null when it would take a double sharp or flat. */
export function toAccidental(semitones: number): Accidental | null {
  return semitones === -1 || semitones === 0 || semitones === 1 ? semitones : null;
}

function naturalLetter(pitchClass: PitchClass): Letter {
  const letter = NATURAL_LETTER[pitchClass];
  if (letter === undefined) throw new RangeError(`pitch class ${pitchClass} is not a natural`);
  return letter;
}

export function spellingName({ letter, accidental }: NoteSpelling): string {
  return `${LETTERS[letter]}${ACCIDENTAL_GLYPH[accidental]}`;
}

export function spellingPitchClass({ letter, accidental }: NoteSpelling): PitchClass {
  return toPitchClass(LETTER_PITCH_CLASS[letter] + accidental);
}

/** The ordinary name of a pitch class, with sharps or flats. */
export function plainSpelling(pitchClass: number, spelling: Spelling): NoteSpelling {
  const pc = toPitchClass(pitchClass);
  const natural = NATURAL_LETTER[pc];
  if (natural !== undefined) return { letter: natural, accidental: 0 };
  // A black key: the natural a semitone above (for a flat) or below (for a sharp).
  if (spelling === 'flats') return { letter: naturalLetter(toPitchClass(pc + 1)), accidental: -1 };
  return { letter: naturalLetter(toPitchClass(pc - 1)), accidental: 1 };
}

/** The note `interval` above a root, spelt on the letter the interval names. */
export function spellInterval(root: NoteSpelling, interval: Pick<ChordInterval, 'semitones' | 'degree'>, tie: Spelling): NoteSpelling {
  const letter = letterAbove(root.letter, interval.degree - 1);
  const target = spellingPitchClass(root) + interval.semitones;
  // Wrapped into −6…+5 so B♯ and C♭ come out as one semitone, not eleven.
  const wrapped = toPitchClass(target - LETTER_PITCH_CLASS[letter] + 6) - 6;
  const accidental = toAccidental(wrapped);
  if (accidental !== null) return { letter, accidental };
  // A double sharp or flat (F𝄪 in B augmented) is correct and unreadable on a
  // fingerboard diagram: name the sounding note plainly instead.
  return plainSpelling(target, wrapped > 0 ? 'sharps' : tie);
}

// ─── Chord roots ─────────────────────────────────────────────────────────────

type RootChoice = string | readonly [sharp: string, flat: string];

/** Major-family roots, by the major key's signature. */
const MAJOR_ROOTS: ByPitchClass<RootChoice> = ['C', 'D♭', 'D', 'E♭', 'E', 'F', ['F♯', 'G♭'], 'G', 'A♭', 'A', 'B♭', 'B'];
/** Minor-family roots, by the minor key's signature. */
const MINOR_ROOTS: ByPitchClass<RootChoice> = ['C', 'C♯', 'D', ['D♯', 'E♭'], 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
/** Diminished roots: E♭dim and B♭dim would need a double flat (B𝄫, F♭). */
const DIMINISHED_ROOTS: ByPitchClass<RootChoice> = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** Augmented: F♯ augmented needs C𝄪, G♭ augmented is G♭ B♭ D. */
const AUGMENTED_ROOTS: ByPitchClass<RootChoice> = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const ROOTS_BY_TYPE: Record<ChordTypeId, ByPitchClass<RootChoice>> = {
  maj: MAJOR_ROOTS, 7: MAJOR_ROOTS, maj7: MAJOR_ROOTS, sus2: MAJOR_ROOTS, sus4: MAJOR_ROOTS, 5: MAJOR_ROOTS,
  m: MINOR_ROOTS, m7: MINOR_ROOTS,
  dim: DIMINISHED_ROOTS,
  aug: AUGMENTED_ROOTS,
};

/** `F♯` → { letter: F, accidental: +1 }. */
export function parseSpelling(name: string): NoteSpelling {
  const letter = LETTER_BY_NAME.get(name.charAt(0));
  if (letter === undefined) throw new Error(`not a note name: "${name}"`);
  const mark = name.slice(1);
  let accidental: Accidental = 0;
  if (mark === '♯') accidental = 1;
  else if (mark === '♭') accidental = -1;
  return { letter, accidental };
}

function choose(choice: RootChoice, tie: Spelling): string {
  if (typeof choice === 'string') return choice;
  return tie === 'flats' ? choice[1] : choice[0];
}

/** How a chart spells this chord's root, outside any key. */
export function chordRootSpelling(root: number, type: ChordTypeId, tie: Spelling): NoteSpelling {
  return parseSpelling(choose(ROOTS_BY_TYPE[type][toPitchClass(root)], tie));
}

/** `B♭m7`. */
export function chordSymbol(root: NoteSpelling, type: ChordTypeId): string {
  return `${spellingName(root)}${CHORD_TYPES[type].suffix}`;
}

/** Every tone of the chord, root first, spelt from the root. */
export function chordToneSpellings(root: NoteSpelling, type: ChordTypeId, tie: Spelling): NoteSpelling[] {
  return CHORD_TYPES[type].intervals.map((interval) => spellInterval(root, interval, tie));
}

/** The name of a sounding note within a chord: spelt as the chord spells it. */
export function noteInChord(pitchClass: number, root: NoteSpelling, type: ChordTypeId, tie: Spelling): string {
  const pc = toPitchClass(pitchClass);
  const tone = chordToneSpellings(root, type, tie).find((note) => spellingPitchClass(note) === pc);
  return spellingName(tone ?? plainSpelling(pc, tie));
}

/** Major keys and the minor keys' tonics, by the same rule as chord roots. */
export function keyTonicSpelling(tonic: number, mode: 'major' | 'minor', tie: Spelling): NoteSpelling {
  return chordRootSpelling(tonic, mode === 'major' ? 'maj' : 'm', tie);
}
