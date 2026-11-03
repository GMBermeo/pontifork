/**
 * Chord sequences: the chords of a song, in order, saved on the device.
 *
 * A sequence keeps chords as they sound (F, then B, then D), the shape picked
 * for each, and the instrument, tuning and capo it was made for, so that
 * opened in another tuning it still says the same chords and can offer to
 * switch back. Pure, so it is tested in Node; `sequences.ts` persists it.
 */

import {
  clampCapo, isChordTypeId, isInstrumentId, toPitchClass, tuningsFor, validStringCount,
  type ChordTypeId, type InstrumentId,
} from '@domain';

import { isObject, type Stored } from './stored';

export interface SequenceChord {
  /** Unique within the sequence, so the same chord can appear twice. */
  id: string;
  root: number;
  type: ChordTypeId;
  /** Which of the chord's shapes, by position in the book's list. */
  shape: number;
}

/** The setup a sequence was made for. */
export interface MadeFor {
  instrument: InstrumentId;
  strings: number;
  tuningId: string;
  capo: number;
}

export interface ChordSequence {
  id: string;
  name: string;
  chords: SequenceChord[];
  madeFor: MadeFor;
}

export interface SequencesState {
  sequences: ChordSequence[];
  /** The sequence in the strip, or null before the first chord is added. */
  openId: string | null;
}

export const EMPTY_SEQUENCES: SequencesState = { sequences: [], openId: null };

export const MAX_SEQUENCES = 50;
export const MAX_CHORDS = 64;
export const MAX_NAME_LENGTH = 40;
/** The pace of a play-through: long enough to change chords, short enough to hear the song. */
export const PLAY_THROUGH_MS = 2000;

// ─── Reading a stored copy ───────────────────────────────────────────────────

function cleanName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
}

function sanitizeMadeFor(value: unknown): MadeFor | null {
  if (!isObject(value)) return null;
  const raw: Stored<MadeFor> = value;
  if (!isInstrumentId(raw.instrument)) return null;
  const strings = validStringCount(raw.instrument, raw.strings);
  const tunings = tuningsFor(raw.instrument, strings);
  const tuning = tunings.find(({ id }) => id === raw.tuningId) ?? tunings[0];
  return { instrument: raw.instrument, strings, tuningId: tuning.id, capo: clampCapo(raw.capo) };
}

function sanitizeChord(value: unknown): SequenceChord | null {
  if (!isObject(value)) return null;
  const raw: Stored<SequenceChord> = value;
  if (typeof raw.id !== 'string' || !isChordTypeId(raw.type)) return null;
  if (typeof raw.root !== 'number' || !Number.isInteger(raw.root)) return null;
  const shape = typeof raw.shape === 'number' && Number.isInteger(raw.shape) && raw.shape >= 0 ? raw.shape : 0;
  return { id: raw.id, root: toPitchClass(raw.root), type: raw.type, shape };
}

function sanitizeSequence(value: unknown, index: number): ChordSequence | null {
  if (!isObject(value)) return null;
  const raw: Stored<ChordSequence> = value;
  if (typeof raw.id !== 'string') return null;
  const madeFor = sanitizeMadeFor(raw.madeFor);
  if (!madeFor) return null;
  const chords = Array.isArray(raw.chords)
    ? raw.chords.map(sanitizeChord).filter((chord): chord is SequenceChord => chord !== null).slice(0, MAX_CHORDS)
    : [];
  return { id: raw.id, name: cleanName(raw.name, `Sequence ${index + 1}`), chords, madeFor };
}

/** Sequences from a stored copy; anything unreadable is dropped rather than guessed at. */
export function sanitizeSequences(value: unknown): SequencesState {
  if (!isObject(value)) return EMPTY_SEQUENCES;
  const raw: Stored<SequencesState> = value;
  if (!Array.isArray(raw.sequences)) return EMPTY_SEQUENCES;
  const sequences = raw.sequences
    .map(sanitizeSequence)
    .filter((sequence): sequence is ChordSequence => sequence !== null)
    .slice(0, MAX_SEQUENCES);
  const open = sequences.find(({ id }) => id === raw.openId) ?? sequences[0];
  return { sequences, openId: open?.id ?? null };
}

// ─── Changes ─────────────────────────────────────────────────────────────────

export function openSequence(state: SequencesState): ChordSequence | null {
  return state.sequences.find((sequence) => sequence.id === state.openId) ?? null;
}

/** `Sequence 3`: the first number no sequence is called by. */
export function nextName(state: SequencesState): string {
  const taken = new Set(state.sequences.map((sequence) => sequence.name));
  let n = state.sequences.length + 1;
  while (taken.has(`Sequence ${n}`)) n++;
  return `Sequence ${n}`;
}

function replace(state: SequencesState, id: string, change: (sequence: ChordSequence) => ChordSequence): SequencesState {
  return { ...state, sequences: state.sequences.map((sequence) => (sequence.id === id ? change(sequence) : sequence)) };
}

/** A new, empty sequence, opened in the strip. */
export function createSequence(state: SequencesState, id: string, madeFor: MadeFor, name?: string): SequencesState {
  if (state.sequences.length >= MAX_SEQUENCES) return state;
  const sequence: ChordSequence = { id, name: cleanName(name, nextName(state)), chords: [], madeFor };
  return { sequences: [...state.sequences, sequence], openId: id };
}

export function renameSequence(state: SequencesState, id: string, name: string): SequencesState {
  return replace(state, id, (sequence) => ({ ...sequence, name: cleanName(name, sequence.name) }));
}

export function deleteSequence(state: SequencesState, id: string): SequencesState {
  const index = state.sequences.findIndex((sequence) => sequence.id === id);
  if (index < 0) return state;
  const sequences = state.sequences.filter((sequence) => sequence.id !== id);
  if (state.openId !== id) return { ...state, sequences };
  const neighbour = sequences[Math.min(index, sequences.length - 1)];
  return { sequences, openId: neighbour?.id ?? null };
}

export function selectSequence(state: SequencesState, id: string): SequencesState {
  return state.sequences.some((sequence) => sequence.id === id) ? { ...state, openId: id } : state;
}

/**
 * Adds a chord to the open sequence, starting one if there is none. An empty
 * sequence takes on the setup its first chord is added in.
 */
export function addChord(
  state: SequencesState,
  chord: Omit<SequenceChord, 'id'>,
  ids: { chord: string; sequence: string },
  madeFor: MadeFor,
): SequencesState {
  const ready = openSequence(state) ? state : createSequence(state, ids.sequence, madeFor);
  const open = openSequence(ready);
  if (!open || open.chords.length >= MAX_CHORDS) return ready;
  return replace(ready, open.id, (sequence) => ({
    ...sequence,
    madeFor: sequence.chords.length === 0 ? madeFor : sequence.madeFor,
    chords: [...sequence.chords, { ...chord, root: toPitchClass(chord.root), id: ids.chord }],
  }));
}

function inOpen(state: SequencesState, change: (chords: SequenceChord[]) => SequenceChord[]): SequencesState {
  const open = openSequence(state);
  return open ? replace(state, open.id, (sequence) => ({ ...sequence, chords: change(sequence.chords) })) : state;
}

export function removeChord(state: SequencesState, chordId: string): SequencesState {
  return inOpen(state, (chords) => chords.filter((chord) => chord.id !== chordId));
}

/** Moves a chord one place earlier (-1) or later (+1). */
export function moveChord(state: SequencesState, chordId: string, step: -1 | 1): SequencesState {
  return inOpen(state, (chords) => {
    const from = chords.findIndex((chord) => chord.id === chordId);
    const to = from + step;
    const moving = chords[from];
    const displaced = chords[to];
    if (from < 0 || !moving || !displaced) return chords;
    const next = [...chords];
    next[from] = displaced;
    next[to] = moving;
    return next;
  });
}

export function setChordShape(state: SequencesState, chordId: string, shape: number): SequencesState {
  return inOpen(state, (chords) => chords.map((chord) => (chord.id === chordId ? { ...chord, shape: Math.max(0, Math.round(shape)) } : chord)));
}

export function clearSequence(state: SequencesState): SequencesState {
  return inOpen(state, () => []);
}

/** The setup a sequence was made for, against the one in use. */
export function sameSetup(a: MadeFor, b: MadeFor): boolean {
  return a.instrument === b.instrument && a.strings === b.strings && a.tuningId === b.tuningId && a.capo === b.capo;
}
