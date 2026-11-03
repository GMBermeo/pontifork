/**
 * The chord book: which shapes play a chord on the instrument, tuning and
 * capo in use, and in what order the book lists its chords.
 *
 * Shapes are worked out from how the tuning relates to the instrument's
 * standard tuning:
 *
 * - **Every string moved by the same amount** (half step down, C standard, a
 *   capo): the shapes do not change, only what they sound. A C shape in half
 *   step down is B, so B's page shows the C shape and says so.
 * - **A drop tuning** (the same, but the lowest string a further whole tone
 *   down): the same shapes, with the lowest string fretted two higher to keep
 *   its note, or left out when that is beyond the hand.
 * - **Anything else** (open tunings, DADGAD, scordatura): the standard shapes
 *   no longer make sense, so the tuning's own are found by search.
 */

import { INSTRUMENTS, type InstrumentId } from '../instruments';
import { itemAt } from '../lists';
import { toPitchClass, type Spelling } from '../pitch';
import { tuningsFor, type Tuning } from '../tunings';
import { chordKey, type ChordRef, type ChordTypeId } from './chordTypes';
import { guitarShapes, sevenStringShapes } from './guitarShapes';
import { keyChords, type MusicalKey } from './keys';
import { searchCello, searchFretted } from './search';
import { fingerShape, soundingNotes, soundsChord, type ChordShape } from './shapes';
import { chordRootSpelling, chordSymbol, type NoteSpelling } from './spelling';

/** The capo's range: past the seventh fret a capo leaves too little neck to play on. */
export const MAX_CAPO = 7;

export interface ChordSetup {
  instrument: InstrumentId;
  strings: number;
  tuning: Tuning;
  /** Ignored on the cello, which has no frets to clamp. */
  capo: number;
}

/** A cello cannot take a capo. */
export function takesCapo(instrument: InstrumentId): boolean {
  return instrument !== 'cello';
}

export function clampCapo(capo: unknown): number {
  if (typeof capo !== 'number' || !Number.isFinite(capo)) return 0;
  return Math.min(MAX_CAPO, Math.max(0, Math.round(capo)));
}

/** What each string sounds open, the capo included. */
export function openNotes(setup: ChordSetup): number[] {
  const capo = takesCapo(setup.instrument) ? clampCapo(setup.capo) : 0;
  return setup.tuning.notes.map((note) => note + capo);
}

export type TuningRelation =
  | { kind: 'shift'; semitones: number }
  | { kind: 'drop'; semitones: number }
  | { kind: 'other' };

function standardTuning(instrument: InstrumentId, strings: number): Tuning {
  const tunings = tuningsFor(instrument, strings);
  return tunings.find((tuning) => tuning.id === 'standard') ?? tunings[0];
}

/** How the open strings (capo included) relate to the instrument's standard tuning. */
export function tuningRelation(setup: ChordSetup): TuningRelation {
  const standard = standardTuning(setup.instrument, setup.strings).notes;
  const open = openNotes(setup);
  if (open.length !== standard.length) return { kind: 'other' };
  const [lowest, ...higher] = open.map((note, string) => note - itemAt(standard, string));
  const upper = higher.at(-1) ?? lowest;
  if (lowest === undefined || upper === undefined) return { kind: 'other' };
  const upperAllSame = higher.every((move) => move === upper);
  if (upperAllSame && lowest === upper) return { kind: 'shift', semitones: upper };
  if (upperAllSame && lowest === upper - 2) return { kind: 'drop', semitones: upper };
  return { kind: 'other' };
}

/** The instrument's shapes in its standard tuning. */
function standardShapes(instrument: InstrumentId, strings: number, chord: ChordRef): ChordShape[] {
  if (instrument === 'guitar') return strings === 7 ? sevenStringShapes(chord.root, chord.type) : guitarShapes(chord.root, chord.type);
  return searchShapes(instrument, standardTuning(instrument, strings).notes, chord);
}

/** How a shape was changed to fit a drop tuning. */
export type DropChange = 'raised' | 'muted';

export interface BookShape extends ChordShape {
  /** What the shape is called where that is not obvious: `C shape`, `E shape · fret 3`. */
  label: string | null;
  /** Sounding MIDI note per string, lowest first; null where a string is left out. */
  notes: (number | null)[];
  drop?: DropChange;
}

/**
 * What a drop tuning is for: the three lowest strings are root, fifth and
 * octave, so one finger laid across them (or none, on the open strings) plays
 * a power chord.
 */
function oneFingerPowerChord(open: readonly number[], chord: ChordRef): ChordShape | null {
  if (chord.type !== '5') return null;
  const fret = toPitchClass(chord.root - itemAt(open, 0));
  const frets = open.map((_, string) => (string < 3 ? fret : null));
  if (!soundsChord(frets, open, chord)) return null;
  const finger = fret === 0 ? 0 : 1;
  return { frets, fingers: frets.map((f) => (f === null ? null : finger)), source: { kind: 'one-finger', fret } };
}

/** Strings sounded in one unbroken run, as a strum needs. */
function contiguous(frets: readonly (number | null)[]): boolean {
  const sounded = frets.flatMap((fret, string) => (fret === null ? [] : [string]));
  const [first] = sounded;
  const last = sounded.at(-1);
  return first !== undefined && last !== undefined && last - first + 1 === sounded.length;
}

/** A standard shape moved into a drop tuning, or null when it no longer works. */
function intoDrop(shape: ChordShape, open: readonly number[], chord: ChordRef): (ChordShape & { drop?: DropChange }) | null {
  const low = shape.frets[0];
  if (low === null || low === undefined) return shape;
  const raised = [low + 2, ...shape.frets.slice(1)];
  const raisedFingers = fingerShape(raised);
  if (raisedFingers && soundsChord(raised, open, chord)) return { ...shape, frets: raised, fingers: raisedFingers, drop: 'raised' };
  const muted = [null, ...shape.frets.slice(1)];
  const mutedFingers = fingerShape(muted);
  if (mutedFingers && contiguous(muted) && soundsChord(muted, open, chord)) return { ...shape, frets: muted, fingers: mutedFingers, drop: 'muted' };
  return null;
}

function shapeLabel(shape: ChordShape & { drop?: DropChange }, shifted: boolean, strings: number): string | null {
  const parts: string[] = [];
  const { source } = shape;
  if (source.kind === 'one-finger') return source.fret === 0 ? 'Open low strings' : `One finger · fret ${source.fret}`;
  // An open shape is named when it no longer sounds its own name, or no longer looks like itself.
  if (source.kind === 'open' && (shifted || shape.drop !== undefined)) parts.push(`${chordSymbol(chordRootSpelling(source.learnt.root, source.learnt.type, 'sharps'), source.learnt.type)} shape`);
  if (source.kind === 'barre') {
    parts.push(`${source.form} shape`);
    if (source.lowString === true) parts.push(`string ${strings}`);
    parts.push(`fret ${source.fret}`);
  }
  if (shape.drop === 'raised') parts.push('low string +2');
  if (shape.drop === 'muted') parts.push('low string off');
  return parts.length ? parts.join(' · ') : null;
}

function dedupe<T extends ChordShape>(shapes: T[]): T[] {
  const seen = new Set<string>();
  return shapes.filter((shape) => {
    const key = shape.frets.join();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The tuning's own shapes, for an instrument in a tuning the standard shapes do not fit. */
function searchShapes(instrument: InstrumentId, open: readonly number[], chord: ChordRef): ChordShape[] {
  if (instrument === 'cello') return searchCello(open, chord);
  return searchFretted(open, chord, instrument === 'bass' ? 'bass' : 'strummed');
}

const cache = new Map<string, BookShape[]>();

/** Every shape the book shows for a chord, best first. */
export function shapesFor(setup: ChordSetup, chord: ChordRef): BookShape[] {
  const open = openNotes(setup);
  const key = `${setup.instrument}-${setup.strings}|${open.join(',')}|${chordKey(chord)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const relation = tuningRelation(setup);
  let shapes: (ChordShape & { drop?: DropChange })[];
  if (relation.kind === 'other') {
    shapes = searchShapes(setup.instrument, open, chord);
  } else {
    // What the shapes are called in standard tuning: B sounds where C was played.
    const learnt = { root: toPitchClass(chord.root - relation.semitones), type: chord.type };
    const standard = standardShapes(setup.instrument, setup.strings, learnt);
    if (relation.kind === 'shift') {
      shapes = standard;
    } else {
      const power = oneFingerPowerChord(open, chord);
      const moved = standard.map((shape) => intoDrop(shape, open, chord)).filter((shape): shape is ChordShape & { drop?: DropChange } => shape !== null);
      shapes = dedupe(power ? [power, ...moved] : moved);
    }
  }
  const shifted = relation.kind !== 'other' && toPitchClass(relation.semitones) !== 0;
  const result = shapes.map((shape) => ({
    ...shape,
    label: shapeLabel(shape, shifted, setup.strings),
    notes: soundingNotes(shape.frets, open),
  }));
  cache.set(key, result);
  return result;
}

// ─── The book's pages ────────────────────────────────────────────────────────

/** A tab of the book: one chord type, or the chords of the selected key. */
export type BookTab = ChordTypeId | 'key';

export interface BookEntry extends ChordRef {
  spelling: NoteSpelling;
  symbol: string;
  /** Its degree in the selected key, when it is one of the key's chords. */
  degree: string | null;
}

function entry(chord: ChordRef, spelling: NoteSpelling, degree: string | null): BookEntry {
  return { ...chord, spelling, symbol: chordSymbol(spelling, chord.type), degree };
}

/**
 * The chords a tab lists, in order. The key tab lists the key's chords in
 * degree order; a type tab lists all twelve roots from C, with the key's
 * chords of that type first.
 */
export function bookPage(tab: BookTab, key: MusicalKey | null, tie: Spelling): BookEntry[] {
  const inKey = key ? keyChords(key, tie) : [];
  if (tab === 'key') return inKey.map((chord) => entry(chord, chord.spelling, chord.degree));
  const first = inKey.filter((chord) => chord.type === tab).map((chord) => entry(chord, chord.spelling, chord.degree));
  const listed = new Set(first.map((chord) => chord.root));
  const rest = Array.from({ length: 12 }, (_, root) => root)
    .filter((root) => !listed.has(root))
    .map((root) => entry({ root, type: tab }, chordRootSpelling(root, tab, tie), null));
  return [...first, ...rest];
}

/** A chord's name outside any key, as the book writes it. */
export function chordName(chord: ChordRef, tie: Spelling): string {
  return chordSymbol(chordRootSpelling(chord.root, chord.type, tie), chord.type);
}

/** `Guitar · 7 strings` or `Cello`. */
export function setupName(instrument: InstrumentId, strings: number): string {
  const { name, stringCounts } = INSTRUMENTS[instrument];
  return stringCounts.length > 1 ? `${name} · ${strings} strings` : name;
}

