/**
 * Synthetic string tones for the DSP tests: a harmonic series with a given
 * weighting, so the engine faces the same weak-fundamental problem it would on
 * a real instrument without needing recordings in the repository.
 */

export interface ToneOptions {
  sampleRate?: number | undefined;
  seconds?: number;
  /** Amplitude of each harmonic, fundamental first. */
  harmonics?: readonly number[];
  amplitude?: number;
}

/** A plucked or bowed string: strong second and third harmonics, as a microphone hears it. */
export const STRING_HARMONICS = [1, 0.7, 0.5, 0.35, 0.25, 0.15] as const;

/** A fundamental the body barely radiates, as a cello's C2 or a bass's B0 through a phone. */
export const WEAK_FUNDAMENTAL = [0.15, 1, 0.8, 0.5, 0.35, 0.2] as const;

export function tone(frequency: number, options: ToneOptions = {}): Float32Array {
  const {
    sampleRate = 16000, seconds = 0.6, harmonics = STRING_HARMONICS, amplitude = 0.3,
  } = options;
  const out = new Float32Array(Math.round(sampleRate * seconds));
  const total = harmonics.reduce((sum, a) => sum + a, 0);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    harmonics.forEach((weight, h) => {
      sample += weight * Math.sin(2 * Math.PI * frequency * (h + 1) * t);
    });
    out[i] = (amplitude * sample) / total;
  }
  return out;
}

/** Feeds `signal` in audio-callback-sized blocks, calling `onBlock` after each. */
export function feed(signal: Float32Array, onBlock: (block: Float32Array) => void, blockSize = 256): void {
  for (let start = 0; start + blockSize <= signal.length; start += blockSize) {
    onBlock(signal.subarray(start, start + blockSize));
  }
}
