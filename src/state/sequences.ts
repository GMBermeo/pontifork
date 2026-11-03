import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { ChordTypeId } from '@domain';

import {
  addChord, clearSequence, createSequence, deleteSequence, EMPTY_SEQUENCES, moveChord, removeChord, renameSequence,
  sanitizeSequences, selectSequence, setChordShape,
  type ChordSequence, type SequencesState,
} from './sequencesModel';
import { setupNow } from './settings';

/**
 * Saved chord sequences: a module-level store persisted to AsyncStorage, the
 * same way as the settings. Read through the hooks; change through
 * `sequenceActions`.
 */

const STORAGE_KEY = 'pontifork/sequences/v1';

let state: SequencesState = EMPTY_SEQUENCES;
let touched = false;
const listeners = new Set<() => void>();

function commit(next: SequencesState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function update(change: (current: SequencesState) => SequencesState): void {
  const next = change(state);
  if (next === state) return;
  touched = true;
  commit(next);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
    // Unavailable storage (a private browser window): kept for this session only.
  });
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw === null || touched) return;
    commit(sanitizeSequences(JSON.parse(raw)));
  })
  .catch(() => {
    // Unreadable or corrupt: start with none.
  });

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useSequencesState<T>(select: (current: SequencesState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(EMPTY_SEQUENCES));
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Every saved sequence, oldest first. */
export function useSequences(): readonly ChordSequence[] {
  return useSequencesState((current) => current.sequences);
}

/** The sequence in the strip, or null. */
export function useOpenSequence(): ChordSequence | null {
  return useSequencesState((current) => current.sequences.find((sequence) => sequence.id === current.openId) ?? null);
}

export const sequenceActions = {
  create: (name?: string): void => {
    update((current) => createSequence(current, newId(), setupNow(), name));
  },
  rename: (id: string, name: string): void => {
    update((current) => renameSequence(current, id, name));
  },
  remove: (id: string): void => {
    update((current) => deleteSequence(current, id));
  },
  select: (id: string): void => {
    update((current) => selectSequence(current, id));
  },
  /** Adds to the open sequence, starting one if there is none. */
  add: (root: number, type: ChordTypeId, shape: number): void => {
    update((current) => addChord(current, { root, type, shape }, { chord: newId(), sequence: newId() }, setupNow()));
  },
  removeChord: (chordId: string): void => {
    update((current) => removeChord(current, chordId));
  },
  move: (chordId: string, step: -1 | 1): void => {
    update((current) => moveChord(current, chordId, step));
  },
  setShape: (chordId: string, shape: number): void => {
    update((current) => setChordShape(current, chordId, shape));
  },
  clear: (): void => {
    update(clearSequence);
  },
};
