/**
 * A chord, synthesised: a strummed plucked string for guitar and bass, a
 * rolled, bowed-sounding tone for the cello. Pure — notes in, samples out —
 * so the pitch it plays is tested, not trusted. A tuner that plays a chord
 * out of tune would be worse than one that plays nothing.
 *
 * The plucked string is Karplus–Strong: a burst of noise circulating through
 * a delay line one period long, softened a little on every pass. The period
 * is rarely a whole number of samples, so an all-pass filter supplies the
 * fraction (Jaffe and Smith's tuning correction).
 */

import { midiToFrequency } from '@domain';

export type ChordVoice = 'plucked' | 'bowed';

export interface ChordSoundOptions {
  voice: ChordVoice;
  /** Reference pitch: the chord sounds at the tuner's calibration. */
  a4: number;
  sampleRate: number;
  /** Delay between one string and the next: a strum or a roll. */
  spreadMs: number;
  seconds: number;
}

const PEAK = 0.8;
/** Vibrato width as a fraction of the frequency: ±0.15 %, about ±2.6 cents. */
const VIBRATO_DEPTH = 0.0015;

/** Deterministic noise, so a chord sounds (and tests) the same every time. */
function noise(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 31 - 1;
  };
}

/** Adds one plucked string, starting at `start`, into `out`. */
function pluck(out: Float32Array, start: number, frequency: number, sampleRate: number, seed: number): void {
  // The averaging filter delays the loop by half a sample; the all-pass makes up the fraction.
  const period = sampleRate / frequency - 0.5;
  const length = Math.max(2, Math.floor(period));
  const fraction = period - length;
  const coefficient = (1 - fraction) / (1 + fraction);
  const line = new Float32Array(length);
  const random = noise(seed);
  let previous = 0;
  for (let i = 0; i < length; i++) {
    // A gentle low-pass on the burst: a pick on a string, not a snare.
    previous = 0.5 * previous + 0.5 * random();
    line[i] = previous;
  }
  // Low notes ring longer, as wound strings do.
  const sustain = frequency < 110 ? 0.9985 : 0.997;
  let index = 0;
  // y[n] = ½(y[n−L] + y[n−L−1]): the sample leaving the line and the one before it.
  let previous2 = 0;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let n = start; n < out.length; n++) {
    const leaving = line[index]!;
    const averaged = sustain * 0.5 * (leaving + previous2);
    previous2 = leaving;
    const tuned = coefficient * averaged + allpassIn - coefficient * allpassOut;
    allpassIn = averaged;
    allpassOut = tuned;
    line[index] = tuned;
    out[n]! += leaving;
    index = (index + 1) % length;
  }
}

/** Adds one bowed note: a few harmonics under a slow swell and a soft release. */
function bow(out: Float32Array, start: number, frequency: number, sampleRate: number): void {
  const attack = 0.12 * sampleRate;
  const release = 0.35 * sampleRate;
  const end = out.length;
  // A gentle vibrato, as phase modulation so the note's centre stays exactly in tune.
  const vibratoHz = 5.2;
  const swing = (frequency * VIBRATO_DEPTH) / vibratoHz;
  for (let n = start; n < end; n++) {
    const t = (n - start) / sampleRate;
    const phase = 2 * Math.PI * frequency * t + swing * Math.sin(2 * Math.PI * vibratoHz * t);
    let sample = 0;
    for (let harmonic = 1; harmonic <= 8; harmonic++) {
      sample += Math.sin(harmonic * phase) / harmonic ** 1.2;
    }
    const rise = Math.min(1, (n - start) / attack);
    const fall = Math.min(1, (end - n) / release);
    out[n]! += 0.4 * sample * rise * fall;
  }
}

/** The chord, lowest string first, as mono samples peaking at 0.8. */
export function renderChord(notes: readonly number[], options: ChordSoundOptions): Float32Array {
  const out = new Float32Array(Math.round(options.seconds * options.sampleRate));
  const spread = Math.round((options.spreadMs / 1000) * options.sampleRate);
  notes.forEach((midi, index) => {
    const frequency = midiToFrequency(midi, options.a4);
    const start = index * spread;
    if (start >= out.length) return;
    if (options.voice === 'bowed') bow(out, start, frequency, options.sampleRate);
    else pluck(out, start, frequency, options.sampleRate, midi * 7919 + index);
  });
  let peak = 0;
  for (const sample of out) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let n = 0; n < out.length; n++) out[n]! *= PEAK / peak;
  return out;
}

/** 16-bit PCM WAV, mono: what a native audio player can open from a file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  });
  return bytes;
}

/** How each instrument sounds its chords. */
export const CHORD_SOUND: Record<'guitar' | 'bass' | 'cello', Pick<ChordSoundOptions, 'voice' | 'spreadMs' | 'seconds'>> = {
  guitar: { voice: 'plucked', spreadMs: 28, seconds: 2.4 },
  bass: { voice: 'plucked', spreadMs: 45, seconds: 2.8 },
  cello: { voice: 'bowed', spreadMs: 120, seconds: 2.2 },
};
