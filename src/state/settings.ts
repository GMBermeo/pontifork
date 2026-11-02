import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { findTuning, setupKey, validStringCount, type InstrumentId, type Tuning } from '@domain';

import { clampA4, DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settingsModel';

/**
 * The player's settings: a module-level store, persisted to AsyncStorage.
 *
 * Read only through the narrow hooks below, each returning a primitive or a
 * catalogue object, so a component re-renders only when what it draws
 * changes. There is deliberately no whole-object hook. Never read the store
 * through a plain getter during render: React Compiler memoises the call and
 * the value never updates.
 */

const STORAGE_KEY = 'pontifork/settings/v1';

let state: Settings = DEFAULT_SETTINGS;
/** Set by the first change the player makes, so a slow read from storage cannot undo it. */
let touched = false;
const listeners = new Set<() => void>();

function commit(next: Settings): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function update(change: (current: Settings) => Settings): void {
  touched = true;
  commit(change(state));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
    // Storage full or unavailable (a private browser window): the setting
    // still applies for this session, it just will not survive a restart.
  });
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw === null || touched) return;
    commit(sanitizeSettings(JSON.parse(raw)));
  })
  .catch(() => {
    // Unreadable or corrupt: start from the defaults.
  });

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useSettings<T>(select: (settings: Settings) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(DEFAULT_SETTINGS));
}

function currentTuning(settings: Settings): Tuning {
  const strings = settings.strings[settings.instrument];
  return findTuning(settings.instrument, strings, settings.tunings[setupKey(settings.instrument, strings)]);
}

export function useInstrument(): InstrumentId {
  return useSettings((s) => s.instrument);
}

export function useStringCount(): number {
  return useSettings((s) => s.strings[s.instrument]);
}

/** The tuning in use: an object from the catalogue, so its identity is stable. */
export function useTuning(): Tuning {
  return useSettings(currentTuning);
}

export function useA4(): number {
  return useSettings((s) => s.a4);
}

export const settingsActions = {
  setInstrument(instrument: InstrumentId): void {
    update((s) => ({ ...s, instrument }));
  },

  setStringCount(strings: number): void {
    update((s) => ({ ...s, strings: { ...s.strings, [s.instrument]: validStringCount(s.instrument, strings) } }));
  },

  setTuning(id: string): void {
    update((s) => ({ ...s, tunings: { ...s.tunings, [setupKey(s.instrument, s.strings[s.instrument])]: id } }));
  },

  setA4(hz: number): void {
    update((s) => ({ ...s, a4: clampA4(hz) }));
  },
};
