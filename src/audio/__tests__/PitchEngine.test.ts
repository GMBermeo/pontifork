import { describe, expect, it } from 'vitest';

import {
  centsBetween, detectionFloorHz, INSTRUMENT_ORDER, INSTRUMENTS, midiToFrequency, noteName, tuningsFor,
  type InstrumentId,
} from '@domain';

import { harmonicNumber, PitchEngine, type PitchEngineOptions } from '../PitchEngine';
import { feed, tone, WEAK_FUNDAMENTAL, type ToneOptions } from './signals';

function detect(frequency: number, engine: PitchEngineOptions, signal: ToneOptions = {}): number {
  const pitch = new PitchEngine({ useOnsetGate: false, ...engine });
  feed(tone(frequency, { sampleRate: engine.sampleRate, ...signal }), (block) => pitch.push(block));
  const frame = pitch.read();
  return frame.voiced ? frame.frequency : 0;
}

function errorCents(frequency: number, engine: PitchEngineOptions, signal: ToneOptions = {}): number {
  const heard = detect(frequency, engine, signal);
  return heard > 0 ? Math.abs(centsBetween(heard, frequency)) : Infinity;
}

const TOLERANCE_CENTS = 3;

describe('PitchEngine across the catalogue', () => {
  for (const instrument of INSTRUMENT_ORDER) {
    const minFrequency = detectionFloorHz(instrument);
    for (const strings of INSTRUMENTS[instrument].stringCounts) {
      const notes = new Set(tuningsFor(instrument, strings).flatMap((t) => t.notes));
      it(`hears every open string a ${strings}-string ${instrument} is tuned to`, () => {
        const misheard = [...notes]
          .map((midi) => ({ note: noteName(midi), cents: errorCents(midiToFrequency(midi), { minFrequency }) }))
          .filter(({ cents }) => cents > TOLERANCE_CENTS);
        expect(misheard).toEqual([]);
      });
    }
  }
});

describe('PitchEngine octave arbitration', () => {
  const lowStrings: [InstrumentId, string, number][] = [
    ['cello', 'C2', 65.41],
    ['guitar', 'E2', 82.41],
    ['bass', 'E1', 41.2],
    ['bass', 'B0', 30.87],
  ];

  it.each(lowStrings)('keeps a %s %s with a weak fundamental in its own octave', (instrument, _name, frequency) => {
    expect(errorCents(frequency, { minFrequency: detectionFloorHz(instrument) }, { harmonics: WEAK_FUNDAMENTAL }))
      .toBeLessThan(TOLERANCE_CENTS);
  });

  // Forcing the low band to run on every hop is what happens to a real high
  // string whenever the high band's clarity dips — as a plucked note decays.
  // The low band cannot see a period that short and reports a multiple of it,
  // which must not be mistaken for the note's own fundamental.
  const highStrings: [string, number][] = [['B3', 246.94], ['E4', 329.63], ['E5', 659.26]];

  it.each(highStrings)('keeps a guitar %s up when the low band hears a subharmonic', (_name, frequency) => {
    expect(errorCents(frequency, { minFrequency: detectionFloorHz('guitar'), highBandConfidence: 1.01 }))
      .toBeLessThan(TOLERANCE_CENTS);
  });

  it.each([['G2', 98], ['D3', 146.83]])(
    'still trusts the low band for a cello %s whose harmonic the high band locks onto',
    (_name, frequency) => {
      expect(errorCents(frequency, { minFrequency: detectionFloorHz('cello'), highBandConfidence: 1.01 }, { harmonics: WEAK_FUNDAMENTAL }))
        .toBeLessThan(TOLERANCE_CENTS);
    },
  );
});

describe('PitchEngine sample rates', () => {
  it('reaches a drop-A bass at 44.1 kHz', () => {
    expect(errorCents(27.5, { sampleRate: 44100, minFrequency: detectionFloorHz('bass') }, { sampleRate: 44100 }))
      .toBeLessThan(TOLERANCE_CENTS);
  });

  it('builds rather than throws when the hardware rate is too high for the requested floor', () => {
    expect(() => new PitchEngine({ sampleRate: 96000, minFrequency: detectionFloorHz('bass') })).not.toThrow();
  });

  it('reports silence as unvoiced', () => {
    const pitch = new PitchEngine({ useOnsetGate: false });
    feed(new Float32Array(8000), (block) => pitch.push(block));
    expect(pitch.read().voiced).toBe(false);
  });
});

describe('harmonicNumber', () => {
  it('names whole-number ratios', () => {
    expect(harmonicNumber(220, 110)).toBe(2);
    expect(harmonicNumber(247.2, 41.2)).toBe(6);
  });

  it('rejects ratios that are not harmonics', () => {
    expect(harmonicNumber(165, 110)).toBeNull();
    expect(harmonicNumber(110, 110)).toBeNull();
    expect(harmonicNumber(1000, 100)).toBeNull();
  });
});
