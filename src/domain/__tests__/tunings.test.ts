import { describe, expect, it } from 'vitest';

import { INSTRUMENT_ORDER, INSTRUMENTS, stringNumeral, validStringCount, type InstrumentId } from '../instruments';
import { midiToFrequency, noteLetter, toPitchClass } from '../pitch';
import { detectionFloorHz, findTuning, groupByFamily, tuningsFor, type Tuning } from '../tunings';

const SETUPS = INSTRUMENT_ORDER.flatMap((instrument) =>
  INSTRUMENTS[instrument].stringCounts.map((strings) => ({ instrument, strings })));

function byId(instrument: InstrumentId, strings: number, id: string): Tuning {
  const found = tuningsFor(instrument, strings).find((t) => t.id === id);
  if (!found) throw new Error(`missing ${instrument}-${strings}/${id}`);
  return found;
}

const shifted = (notes: readonly number[], semitones: number) => notes.map((n) => n + semitones);
const dropped = (notes: readonly number[]) => [notes[0] - 2, ...notes.slice(1)];

describe('tuning catalogue shape', () => {
  it.each(SETUPS)('$instrument with $strings strings: one note per string, low to high, unique ids', ({ instrument, strings }) => {
    const tunings = tuningsFor(instrument, strings);
    expect(new Set(tunings.map((t) => t.id)).size).toBe(tunings.length);
    for (const t of tunings) {
      expect(t.notes, t.id).toHaveLength(strings);
      t.notes.slice(1).forEach((note, i) => expect(note, t.id).toBeGreaterThan(t.notes[i]));
    }
  });

  it.each(SETUPS)('$instrument with $strings strings starts at standard', ({ instrument, strings }) => {
    const [first] = tuningsFor(instrument, strings);
    expect(first).toMatchObject({ id: 'standard', family: 'standard' });
  });

  it('writes the standards a player would recognise', () => {
    expect(byId('cello', 4, 'standard').notes).toEqual([36, 43, 50, 57]);
    expect(byId('guitar', 6, 'standard').notes).toEqual([40, 45, 50, 55, 59, 64]);
    expect(byId('guitar', 7, 'standard').notes).toEqual([35, 40, 45, 50, 55, 59, 64]);
    expect(byId('bass', 4, 'standard').notes).toEqual([28, 33, 38, 43]);
    expect(byId('bass', 5, 'standard').notes).toEqual([23, 28, 33, 38, 43]);
    expect(byId('bass', 6, 'standard').notes).toEqual([23, 28, 33, 38, 43, 48]);
  });
});

describe('tunings keep the promises in their names', () => {
  const LOWERED: Record<string, number> = {
    'half-step-down': 1, 'whole-step-down': 2, 'c-sharp-standard': 3, 'c-standard': 4, 'b-standard': 5,
  };

  it.each(SETUPS)('lowered standards on a $strings-string $instrument', ({ instrument, strings }) => {
    const standard = byId(instrument, strings, 'standard').notes;
    for (const t of tuningsFor(instrument, strings).filter((x) => x.id in LOWERED)) {
      expect(t.notes, t.id).toEqual(shifted(standard, -LOWERED[t.id]));
    }
  });

  it.each(SETUPS)('every drop tuning on a $strings-string $instrument is a lowered standard with its low string down a tone', ({ instrument, strings }) => {
    const standard = byId(instrument, strings, 'standard').notes;
    const drops = tuningsFor(instrument, strings).filter((t) => t.family === 'drop' && t.id !== 'double-drop-d');
    for (const t of drops) {
      const semitonesDown = standard[1] - t.notes[1];
      expect(t.notes, t.id).toEqual(dropped(shifted(standard, -semitonesDown)));
      const lowest = [noteLetter(t.notes[0], 'sharps'), noteLetter(t.notes[0], 'flats')];
      expect(lowest.some((name) => t.name.includes(name)), `${t.name} names its low string`).toBe(true);
    }
  });

  it('offers every six-string drop from D down to A', () => {
    const drops = tuningsFor('guitar', 6).filter((t) => t.id.startsWith('drop-')).map((t) => noteLetter(t.notes[0]));
    expect(drops).toEqual(['D', 'C♯', 'C', 'B', 'A♯', 'A']);
  });

  it('double drop D lowers both E strings', () => {
    const standard = byId('guitar', 6, 'standard').notes;
    expect(byId('guitar', 6, 'double-drop-d').notes).toEqual([standard[0] - 2, ...standard.slice(1, 5), standard[5] - 2]);
  });

  const OPEN_CHORDS: [string, number, number][] = [
    ['open-d', 2, 4], ['open-e', 4, 4], ['open-g', 7, 4], ['open-a', 9, 4], ['open-c', 0, 4], ['open-d-minor', 2, 3],
  ];

  it.each(OPEN_CHORDS)('%s rings its chord', (id, root, third) => {
    const pitchClasses = new Set(byId('guitar', 6, id).notes.map(toPitchClass));
    expect(pitchClasses).toEqual(new Set([root, (root + third) % 12, (root + 7) % 12]));
  });
});

describe('lookup', () => {
  it('falls back to standard for an unknown id', () => {
    expect(findTuning('guitar', 7, 'no-such-tuning').id).toBe('standard');
    expect(findTuning('bass', 5, undefined).id).toBe('standard');
  });

  it('throws for a setup with no catalogue', () => {
    expect(() => tuningsFor('cello', 6)).toThrow();
  });

  it('groups families in display order', () => {
    expect(groupByFamily(tuningsFor('guitar', 6)).map((g) => g.family)).toEqual(['standard', 'drop', 'open', 'alternate']);
    expect(groupByFamily(tuningsFor('cello', 4)).map((g) => g.family)).toEqual(['standard', 'scordatura']);
  });

  it('defaults guitar to six strings and bass to four', () => {
    expect(validStringCount('guitar', undefined)).toBe(6);
    expect(validStringCount('bass', 9)).toBe(4);
    expect(validStringCount('bass', 5)).toBe(5);
  });

  it('numbers strings the way each instrument does', () => {
    expect(stringNumeral('cello', 0, 4)).toBe('IV');
    expect(stringNumeral('cello', 3, 4)).toBe('I');
    expect(stringNumeral('guitar', 0, 7)).toBe('7');
    expect(stringNumeral('guitar', 5, 6)).toBe('1');
  });
});

describe('detection floor', () => {
  it.each(INSTRUMENT_ORDER)('sits below the lowest %s string in the catalogue', (instrument) => {
    const lowest = Math.min(...INSTRUMENTS[instrument].stringCounts.flatMap((n) => tuningsFor(instrument, n)).map((t) => t.notes[0]));
    expect(detectionFloorHz(instrument)).toBeLessThan(midiToFrequency(lowest, 415));
  });

  it('reaches a drop-A five-string bass', () => {
    expect(detectionFloorHz('bass')).toBeLessThan(27.5);
    expect(detectionFloorHz('bass')).toBeGreaterThan(20);
  });
});
