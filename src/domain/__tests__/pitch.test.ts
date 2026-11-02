import { describe, expect, it } from 'vitest';

import {
  centsBetween, formatCents, frequencyToMidi, judgeTuning, midiToFrequency, noteLetter, noteName, parseNote,
  tuneDirection,
} from '../pitch';

describe('pitch conversions', () => {
  it.each([[69, 440], [57, 220], [40, 82.41], [28, 41.2], [23, 30.87]])('MIDI %i is %f Hz', (midi, hz) => {
    expect(midiToFrequency(midi)).toBeCloseTo(hz, 1);
    expect(frequencyToMidi(hz)).toBeCloseTo(midi, 1);
  });

  it('follows the reference pitch', () => {
    expect(midiToFrequency(69, 442)).toBe(442);
    expect(midiToFrequency(57, 415)).toBeCloseTo(207.5, 6);
    expect(frequencyToMidi(442, 442)).toBe(69);
  });

  it('measures cents logarithmically, sharp positive', () => {
    expect(centsBetween(440, 440)).toBe(0);
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 6);
    expect(centsBetween(midiToFrequency(61), midiToFrequency(60))).toBeCloseTo(100, 6);
  });

  it('formats cents with a true minus sign', () => {
    expect(formatCents(12.4)).toBe('+12¢');
    expect(formatCents(-7.6)).toBe('−8¢');
    expect(formatCents(0.3)).toBe('0¢');
  });
});

describe('note names', () => {
  it('spells in sharps or flats', () => {
    expect(noteName(40)).toBe('E2');
    expect(noteName(63)).toBe('D♯4');
    expect(noteName(63, 'flats')).toBe('E♭4');
    expect(noteLetter(34, 'flats')).toBe('B♭');
    expect(noteName(23)).toBe('B0');
  });

  it.each([['E2', 40], ['A4', 69], ['Bb1', 34], ['C#3', 49], ['D♭4', 61], ['F♯2', 42], ['B0', 23], ['A0', 21]])(
    'parses %s as MIDI %i', (name, midi) => {
      expect(parseNote(name)).toBe(midi);
    },
  );

  it('round-trips every name it prints', () => {
    for (let midi = 21; midi <= 88; midi++) {
      expect(parseNote(noteName(midi))).toBe(midi);
      expect(parseNote(noteName(midi, 'flats'))).toBe(midi);
    }
  });

  it.each(['H2', 'E', 'Eb', 'e2', 'E##2', ''])('rejects %j', (name) => {
    expect(() => parseNote(name)).toThrow();
  });
});

describe('tuning verdicts', () => {
  it.each([[0, 'in-tune'], [5, 'in-tune'], [-5, 'in-tune'], [5.1, 'close'], [-20, 'close'], [21, 'off'], [-300, 'off']] as const)(
    '%f cents is %s', (cents, verdict) => {
      expect(judgeTuning(cents)).toBe(verdict);
    },
  );

  it('tunes a flat string up and a sharp one down', () => {
    expect(tuneDirection(-12)).toBe('up');
    expect(tuneDirection(30)).toBe('down');
    expect(tuneDirection(3)).toBeNull();
  });
});
