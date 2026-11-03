import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import {
  clampCapo, findTuning, keyId, setupKey, validStringCount,
  type BookTab, type DotLabels, type InstrumentId, type KeyId, type MusicalKey, type Tuning,
} from '@domain';

import { clampA4, DEFAULT_SETTINGS, sanitizeSettings, type BookSettings, type Settings } from './settingsModel';

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

/**
 * The instrument, strings, tuning and capo in use, for an event handler (a
 * sequence records what it was made for). Never call it during render: use
 * the hooks, or the value will not update.
 */
export function setupNow(): { instrument: InstrumentId; strings: number; tuningId: string; capo: number } {
  return { instrument: state.instrument, strings: state.strings[state.instrument], tuningId: currentTuning(state).id, capo: state.book.capo };
}

// ─── The chord book ──────────────────────────────────────────────────────────

export function useBookTab(): BookTab {
  return useSettings((s) => s.book.tab);
}

/** The key filter as stored (`9-minor`), or null; parse it with `parseKeyId`. */
export function useBookKey(): KeyId | null {
  return useSettings((s) => s.book.key);
}

export function useDotLabels(): DotLabels {
  return useSettings((s) => s.book.labels);
}

export function useAllPositions(): boolean {
  return useSettings((s) => s.book.allPositions);
}

export function useLeftHanded(): boolean {
  return useSettings((s) => s.book.leftHanded);
}

/** The capo as set, whatever the instrument; the book ignores it on the cello. */
export function useCapo(): number {
  return useSettings((s) => s.book.capo);
}

export function useChordSound(): boolean {
  return useSettings((s) => s.book.sound);
}

function updateBook(change: (book: BookSettings) => BookSettings): void {
  update((s) => ({ ...s, book: change(s.book) }));
}

export const bookActions = {
  setTab: (tab: BookTab): void => {
    updateBook((book) => (tab === 'key' && book.key === null ? book : { ...book, tab }));
  },

  /** Choosing a key opens its page; clearing it leaves that page for the major chords. */
  setKey: (key: MusicalKey | null): void => {
    updateBook((book) => {
      if (key) return { ...book, key: keyId(key), tab: 'key' };
      return { ...book, key: null, tab: book.tab === 'key' ? 'maj' : book.tab };
    });
  },

  setLabels: (labels: DotLabels): void => {
    updateBook((book) => ({ ...book, labels }));
  },

  setAllPositions: (allPositions: boolean): void => {
    updateBook((book) => ({ ...book, allPositions }));
  },

  setLeftHanded: (leftHanded: boolean): void => {
    updateBook((book) => ({ ...book, leftHanded }));
  },

  setCapo: (capo: number): void => {
    updateBook((book) => ({ ...book, capo: clampCapo(capo) }));
  },

  setSound: (sound: boolean): void => {
    updateBook((book) => ({ ...book, sound }));
  },
};

export const settingsActions = {
  setInstrument: (instrument: InstrumentId): void => {
    update((s) => ({ ...s, instrument }));
  },

  setStringCount: (strings: number): void => {
    update((s) => ({ ...s, strings: { ...s.strings, [s.instrument]: validStringCount(s.instrument, strings) } }));
  },

  setTuning: (id: string): void => {
    update((s) => ({ ...s, tunings: { ...s.tunings, [setupKey(s.instrument, s.strings[s.instrument])]: id } }));
  },

  setA4: (hz: number): void => {
    update((s) => ({ ...s, a4: clampA4(hz) }));
  },

  /** Instrument, string count, tuning and capo at once: what a saved sequence was made for. */
  setSetup: (instrument: InstrumentId, strings: number, tuningId: string, capo: number): void => {
    update((s) => {
      const count = validStringCount(instrument, strings);
      const tuning = findTuning(instrument, count, tuningId);
      return {
        ...s,
        instrument,
        strings: { ...s.strings, [instrument]: count },
        tunings: { ...s.tunings, [setupKey(instrument, count)]: tuning.id },
        book: { ...s.book, capo: clampCapo(capo) },
      };
    });
  },
};
