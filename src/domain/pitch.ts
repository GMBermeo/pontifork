/**
 * Pitch arithmetic shared by the engine, the tuning catalogue and the screen.
 *
 * Every conversion takes the reference pitch as an argument rather than
 * reading a constant, because the player can move it: orchestras sit anywhere
 * from 440 to 443 Hz, and baroque ensembles at 415.
 */

/** Concert pitch, and the reference every tuning is written against. */
export const DEFAULT_A4_HZ = 440;
/** Baroque pitch: the lowest reference the calibration offers. */
export const A4_MIN_HZ = 415;
/** A semitone above concert pitch: the highest reference the calibration offers. */
export const A4_MAX_HZ = 466;

const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;
const CENTS_PER_OCTAVE = 1200;

export function midiToFrequency(midi: number, a4 = DEFAULT_A4_HZ): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

export function frequencyToMidi(hz: number, a4 = DEFAULT_A4_HZ): number {
  return A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(hz / a4);
}

/**
 * Logarithmic distance from a detected pitch to its target, in cents.
 * Positive is sharp. This is the number the whole display is built on.
 */
export function centsBetween(detectedHz: number, targetHz: number): number {
  return CENTS_PER_OCTAVE * Math.log2(detectedHz / targetHz);
}

/** Whole cents with an explicit sign: `+12¢`, `−7¢`, `0¢`. Uses a true minus sign. */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  let sign = '';
  if (rounded > 0) sign = '+';
  else if (rounded < 0) sign = '−';
  return `${sign}${Math.abs(rounded)}¢`;
}

// ─── Note names ──────────────────────────────────────────────────────────────

/** Whether accidentals are written as sharps or flats. A tuning picks one for all its strings. */
export type Spelling = 'sharps' | 'flats';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

/** 0 = C … 11 = B, for any integer — negative intervals included. */
export function toPitchClass(n: number): number {
  return ((n % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
}

/** Scientific-pitch octave: middle C (MIDI 60) is C4. */
export function octaveOf(midi: number): number {
  return Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
}

/** The letter and accidental alone: `E♭`. */
export function noteLetter(midi: number, spelling: Spelling = 'sharps'): string {
  const names = spelling === 'flats' ? FLAT_NAMES : SHARP_NAMES;
  return names[toPitchClass(midi)];
}

/** Letter, accidental and octave: `E♭2`. */
export function noteName(midi: number, spelling: Spelling = 'sharps'): string {
  return `${noteLetter(midi, spelling)}${octaveOf(midi)}`;
}

const LETTER_PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_SHIFT: Record<string, number> = { '': 0, '#': 1, '♯': 1, b: -1, '♭': -1 };
const NOTE_PATTERN = /^([A-G])([#♯b♭])?(-?\d)$/;

/**
 * MIDI number of a note written in scientific pitch — `E2`, `F#3`, `Bb1`,
 * `D♭4`. Throws on anything else: the catalogue is written in these strings,
 * and a typo there should fail the tests, not quietly tune a string to C.
 */
export function parseNote(name: string): number {
  const match = NOTE_PATTERN.exec(name.trim());
  if (!match) throw new Error(`not a note in scientific pitch: "${name}"`);
  const [, letter, accidental = '', octave] = match;
  return (Number(octave) + 1) * SEMITONES_PER_OCTAVE + LETTER_PITCH_CLASS[letter] + ACCIDENTAL_SHIFT[accidental];
}

// ─── Tuning tolerance ────────────────────────────────────────────────────────

/**
 * Inside this a string reads as in tune. Five cents is about the smallest
 * step a player can reliably hear against a reference, and the tolerance most
 * hardware tuners light their centre lamp at.
 */
export const IN_TUNE_CENTS = 5;
/** Between in tune and this, the string is close: a fine adjustment away. */
export const CLOSE_CENTS = 20;

export type TuningVerdict = 'in-tune' | 'close' | 'off';

export function judgeTuning(cents: number): TuningVerdict {
  const distance = Math.abs(cents);
  if (distance <= IN_TUNE_CENTS) return 'in-tune';
  if (distance <= CLOSE_CENTS) return 'close';
  return 'off';
}

/** Which way the peg turns: a flat string is tuned up. Null when already in tune. */
export function tuneDirection(cents: number): 'up' | 'down' | null {
  if (Math.abs(cents) <= IN_TUNE_CENTS) return null;
  return cents < 0 ? 'up' : 'down';
}
