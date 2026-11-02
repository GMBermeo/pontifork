/**
 * The instruments Pontifork tunes, and how players of each one name their
 * strings.
 */

export type InstrumentId = 'cello' | 'guitar' | 'bass';

export interface Instrument {
  id: InstrumentId;
  name: string;
  /** String counts on offer; the first is the default. */
  stringCounts: readonly number[];
  /** How a string is sounded, for the hint under the dial. */
  action: 'Bow' | 'Pluck';
  /**
   * Cellists number strings in Roman numerals, I being the highest (the A
   * string); guitarists and bassists use figures, 1 being the highest.
   */
  numerals: 'roman' | 'arabic';
}

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  cello: { id: 'cello', name: 'Cello', stringCounts: [4], action: 'Bow', numerals: 'roman' },
  guitar: { id: 'guitar', name: 'Guitar', stringCounts: [6, 7], action: 'Pluck', numerals: 'arabic' },
  bass: { id: 'bass', name: 'Bass', stringCounts: [4, 5, 6], action: 'Pluck', numerals: 'arabic' },
};

export const INSTRUMENT_ORDER: readonly InstrumentId[] = ['cello', 'guitar', 'bass'];

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && value in INSTRUMENTS;
}

export function defaultStringCount(instrument: InstrumentId): number {
  return INSTRUMENTS[instrument].stringCounts[0];
}

/** A string count the instrument offers, or its default when it does not. */
export function validStringCount(instrument: InstrumentId, strings: unknown): number {
  const offered = INSTRUMENTS[instrument].stringCounts;
  return typeof strings === 'number' && offered.includes(strings) ? strings : offered[0];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/**
 * The string's number as a player of the instrument would say it. `index`
 * counts from the lowest string, the way the tunings are written; players
 * count from the highest.
 */
export function stringNumeral(instrument: InstrumentId, index: number, count: number): string {
  const number = count - index;
  return INSTRUMENTS[instrument].numerals === 'roman' ? ROMAN[number - 1] : String(number);
}
