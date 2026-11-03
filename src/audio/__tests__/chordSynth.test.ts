import { describe, expect, it } from 'vitest';

import { CHORD_SOUND, encodeWav, renderChord } from '../chordSynth';

const RATE = 22050;

/**
 * The fundamental of a steady stretch of signal, by autocorrelation with
 * parabolic interpolation: accurate to a fraction of a cent on a clean tone.
 */
function pitchOf(samples: Float32Array, from: number, length: number, minHz: number, maxHz: number): number {
  const window = samples.subarray(from, from + length);
  let best = 0;
  let bestLag = 0;
  const scores: number[] = [];
  for (let lag = Math.floor(RATE / maxHz); lag <= Math.ceil(RATE / minHz); lag++) {
    let sum = 0;
    for (let i = 0; i + lag < window.length; i++) sum += (window[i] ?? 0) * (window[i + lag] ?? 0);
    scores[lag] = sum;
    if (sum > best) { best = sum; bestLag = lag; }
  }
  const score = (lag: number) => scores[lag] ?? 0;
  const [a, b, c] = [score(bestLag - 1), score(bestLag), score(bestLag + 1)];
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return RATE / (bestLag + shift);
}

const cents = (hz: number, reference: number) => 1200 * Math.log2(hz / reference);

describe('the chord synthesiser', () => {
  it.each([[45, 110], [57, 220], [69, 440], [64, 329.63]])('plucks MIDI %i at %f Hz, in tune', (midi, hz) => {
    const samples = renderChord([midi], { ...CHORD_SOUND.guitar, a4: 440, sampleRate: RATE });
    expect(Math.abs(cents(pitchOf(samples, RATE * 0.2, 4096, hz * 0.8, hz * 1.25), hz))).toBeLessThan(3);
  });

  it('follows the reference pitch', () => {
    const samples = renderChord([69], { ...CHORD_SOUND.guitar, a4: 415, sampleRate: RATE });
    expect(Math.abs(cents(pitchOf(samples, RATE * 0.2, 4096, 330, 520), 415))).toBeLessThan(3);
  });

  it('bows a cello note in tune', () => {
    const samples = renderChord([48], { ...CHORD_SOUND.cello, a4: 440, sampleRate: RATE });
    expect(Math.abs(cents(pitchOf(samples, RATE * 0.5, 4096, 100, 160), 130.81))).toBeLessThan(3);
  });

  it('strums low to high and stays within full scale', () => {
    const samples = renderChord([40, 47, 52, 56, 59, 64], { ...CHORD_SOUND.guitar, a4: 440, sampleRate: RATE });
    expect(samples).toHaveLength(Math.round(CHORD_SOUND.guitar.seconds * RATE));
    expect(Math.max(...samples.map(Math.abs))).toBeCloseTo(0.8, 5);
  });

  it('writes a mono 16-bit WAV a phone can open', () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1]), RATE);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(bytes).toHaveLength(44 + 6);
  });
});
