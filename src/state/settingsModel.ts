/**
 * The shape of the player's settings, and how a stored copy is read back.
 *
 * Pure, so it can be tested in Node: everything stored is checked against
 * the catalogue on the way in, because a copy written by an older build may
 * name a tuning or a string count that no longer exists.
 */

import {
  A4_MAX_HZ, A4_MIN_HZ, DEFAULT_A4_HZ, INSTRUMENT_ORDER, isInstrumentId, setupKey, tuningsFor, validStringCount,
  type InstrumentId, type SetupKey,
} from '@domain';

export interface Settings {
  instrument: InstrumentId;
  /** The string count last used on each instrument. */
  strings: Record<InstrumentId, number>;
  /** The tuning last picked for each setup, by id. */
  tunings: Partial<Record<SetupKey, string>>;
  /** Reference pitch in Hz. */
  a4: number;
}

export const DEFAULT_SETTINGS: Settings = {
  instrument: 'cello',
  strings: { cello: 4, guitar: 6, bass: 4 },
  tunings: {},
  a4: DEFAULT_A4_HZ,
};

/** A reference pitch on the calibration's whole-hertz grid. */
export function clampA4(hz: unknown): number {
  if (typeof hz !== 'number' || !Number.isFinite(hz)) return DEFAULT_A4_HZ;
  return Math.min(A4_MAX_HZ, Math.max(A4_MIN_HZ, Math.round(hz)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeTunings(raw: unknown, strings: Record<InstrumentId, number>): Partial<Record<SetupKey, string>> {
  if (!isRecord(raw)) return {};
  const tunings: Partial<Record<SetupKey, string>> = {};
  for (const instrument of INSTRUMENT_ORDER) {
    const key = setupKey(instrument, strings[instrument]);
    const id = raw[key];
    if (typeof id === 'string' && tuningsFor(instrument, strings[instrument]).some((t) => t.id === id)) tunings[key] = id;
  }
  return tunings;
}

/** Settings from a stored copy, with anything unknown or out of range replaced by its default. */
export function sanitizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const storedStrings = isRecord(raw.strings) ? raw.strings : {};
  const strings = Object.fromEntries(
    INSTRUMENT_ORDER.map((instrument) => [instrument, validStringCount(instrument, storedStrings[instrument])]),
  ) as Record<InstrumentId, number>;
  return {
    instrument: isInstrumentId(raw.instrument) ? raw.instrument : DEFAULT_SETTINGS.instrument,
    strings,
    tunings: sanitizeTunings(raw.tunings, strings),
    a4: clampA4(raw.a4),
  };
}
