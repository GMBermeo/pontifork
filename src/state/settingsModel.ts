/**
 * The shape of the player's settings, and how a stored copy is read back.
 *
 * Pure, so it can be tested in Node: everything stored is checked against
 * the catalogue on the way in, because a copy written by an older build may
 * name a tuning or a string count that no longer exists.
 */

import {
  A4_MAX_HZ, A4_MIN_HZ, clampCapo, DEFAULT_A4_HZ, INSTRUMENT_ORDER, isChordTypeId, isInstrumentId, keyId, parseKeyId,
  setupKey, tuningsFor, validStringCount,
  type BookTab, type DotLabels, type InstrumentId, type KeyId, type SetupKey,
} from '@domain';

import { isObject, type Stored } from './stored';

/** How the chord book is set up: which page is open and how diagrams are drawn. */
export interface BookSettings {
  tab: BookTab;
  /** The key filter, or null for every chord. */
  key: KeyId | null;
  labels: DotLabels;
  allPositions: boolean;
  leftHanded: boolean;
  /** Guitar and bass only; the cello ignores it. */
  capo: number;
  /** Play a chord when it is tapped. */
  sound: boolean;
}

export const DEFAULT_BOOK: BookSettings = {
  tab: 'maj',
  key: null,
  labels: 'fingers',
  allPositions: false,
  leftHanded: false,
  capo: 0,
  sound: true,
};

export interface Settings {
  instrument: InstrumentId;
  /** The string count last used on each instrument. */
  strings: Record<InstrumentId, number>;
  /** The tuning last picked for each setup, by id. */
  tunings: Partial<Record<SetupKey, string>>;
  /** Reference pitch in Hz. */
  a4: number;
  book: BookSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  instrument: 'cello',
  strings: { cello: 4, guitar: 6, bass: 4 },
  tunings: {},
  a4: DEFAULT_A4_HZ,
  book: DEFAULT_BOOK,
};

/** A reference pitch on the calibration's whole-hertz grid. */
export function clampA4(hz: unknown): number {
  if (typeof hz !== 'number' || !Number.isFinite(hz)) return DEFAULT_A4_HZ;
  return Math.min(A4_MAX_HZ, Math.max(A4_MIN_HZ, Math.round(hz)));
}

function sanitizeTunings(raw: unknown, strings: Record<InstrumentId, number>): Partial<Record<SetupKey, string>> {
  if (!isObject(raw)) return {};
  const tunings: Partial<Record<SetupKey, string>> = {};
  for (const instrument of INSTRUMENT_ORDER) {
    const key = setupKey(instrument, strings[instrument]);
    const id = raw[key];
    if (typeof id === 'string' && tuningsFor(instrument, strings[instrument]).some((t) => t.id === id)) tunings[key] = id;
  }
  return tunings;
}

/** The chord book's settings from a stored copy: the key tab only exists while a key is chosen. */
export function sanitizeBook(value: unknown): BookSettings {
  if (!isObject(value)) return DEFAULT_BOOK;
  const raw: Stored<BookSettings> = value;
  const key = parseKeyId(raw.key);
  let tab: BookTab = DEFAULT_BOOK.tab;
  if (isChordTypeId(raw.tab)) tab = raw.tab;
  else if (raw.tab === 'key' && key) tab = 'key';
  return {
    tab,
    key: key ? keyId(key) : null,
    labels: raw.labels === 'notes' ? 'notes' : 'fingers',
    allPositions: raw.allPositions === true,
    leftHanded: raw.leftHanded === true,
    capo: clampCapo(raw.capo),
    sound: raw.sound !== false,
  };
}

/** Settings from a stored copy, with anything unknown or out of range replaced by its default. */
export function sanitizeSettings(value: unknown): Settings {
  if (!isObject(value)) return DEFAULT_SETTINGS;
  const raw: Stored<Settings> = value;
  const storedStrings = isObject(raw.strings) ? raw.strings : {};
  const strings = Object.fromEntries(
    INSTRUMENT_ORDER.map((instrument) => [instrument, validStringCount(instrument, storedStrings[instrument])]),
  ) as Record<InstrumentId, number>;
  return {
    instrument: isInstrumentId(raw.instrument) ? raw.instrument : DEFAULT_SETTINGS.instrument,
    strings,
    tunings: sanitizeTunings(raw.tunings, strings),
    a4: clampA4(raw.a4),
    book: sanitizeBook(raw.book),
  };
}
