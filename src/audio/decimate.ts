/**
 * Anti-alias filtering and decimation for the low-frequency analysis branch.
 *
 * C2 has a 15.3 ms period, so resolving it needs ~2.8 periods — 2048 samples
 * at 48 kHz. Running the pitch detector over a window that long at full rate
 * is wasteful, because there is nothing above a few hundred hertz worth
 * looking at down there. Band-limiting and dropping to 12 kHz gives the same
 * 42.7 ms of history in a 512-sample window, which is ~5× cheaper.
 */

/** A biquad's coefficients, normalised so a0 is 1. */
interface BiquadCoefficients {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

/** One biquad section in transposed direct form II. */
class Biquad {
  private readonly c: BiquadCoefficients;
  private z1 = 0;
  private z2 = 0;

  constructor(coefficients: BiquadCoefficients) {
    this.c = coefficients;
  }

  process(x: number): number {
    const { b0, b1, b2, a1, a2 } = this.c;
    const y = b0 * x + this.z1;
    this.z1 = b1 * x - a1 * y + this.z2;
    this.z2 = b2 * x - a2 * y;
    return y;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }
}

function lowpassBiquad(sampleRate: number, cutoffHz: number, q: number): Biquad {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);

  const a0 = 1 + alpha;
  return new Biquad({
    b0: ((1 - cos) / 2) / a0,
    b1: (1 - cos) / a0,
    b2: ((1 - cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  });
}

/** Section Q values for a 4th-order Butterworth response: two biquads. */
const BUTTERWORTH_Q4 = [1 / (2 * Math.cos(Math.PI / 8)), 1 / (2 * Math.cos((3 * Math.PI) / 8))] as const;

/**
 * Default band limit before the ÷4 drop.
 *
 * Deliberately not the ~300 Hz you might pick from the low band's 55–220 Hz
 * target range: at the top of that range a 300 Hz corner would leave a 220 Hz
 * note with nothing but its fundamental, and the fundamental is exactly the
 * partial an acoustic cello body under-radiates. 1 kHz keeps four or five
 * harmonics of every note in the band — which is what carries the periodicity
 * when the fundamental is weak — while still sitting 2.6 octaves below the
 * decimated Nyquist of 6 kHz, where the 4th-order roll-off is past −60 dB.
 */
export const DEFAULT_BAND_LIMIT_HZ = 1000;

export class Decimator {
  readonly factor: number;
  readonly outputSampleRate: number;
  private readonly first: Biquad;
  private readonly second: Biquad;
  private phase = 0;

  constructor(sampleRate: number, factor = 4, cutoffHz = DEFAULT_BAND_LIMIT_HZ) {
    this.factor = factor;
    this.outputSampleRate = sampleRate / factor;
    this.first = lowpassBiquad(sampleRate, cutoffHz, BUTTERWORTH_Q4[0]);
    this.second = lowpassBiquad(sampleRate, cutoffHz, BUTTERWORTH_Q4[1]);
  }

  /**
   * Filters `input` and writes every `factor`-th sample to `output`.
   * Returns how many output samples were produced. Decimation phase is kept
   * across calls, so block boundaries do not shift the output grid.
   */
  process(input: Float32Array, count: number, output: Float32Array): number {
    let written = 0;
    for (let i = 0; i < count; i++) {
      const x = this.second.process(this.first.process(input[i]!));
      if (this.phase === 0) output[written++] = x;
      this.phase = (this.phase + 1) % this.factor;
    }
    return written;
  }

  reset(): void {
    this.first.reset();
    this.second.reset();
    this.phase = 0;
  }
}

/**
 * Fixed-size circular sample history.
 *
 * The analysis windows overlap heavily — 512 samples advancing 128 at a time —
 * so the engine needs to look backwards at arbitrary offsets without copying
 * the whole stream around on every audio callback.
 */
export class RingBuffer {
  readonly capacity: number;
  private readonly buffer: Float32Array;
  private writeIndex = 0;
  /** Total samples ever written; the caller uses this as a monotonic clock. */
  written = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  write(samples: Float32Array, count = samples.length): void {
    if (count <= 0) return;
    this.written += count;

    let start = 0;
    let toWrite = count;
    if (toWrite > this.capacity) {
      start = toWrite - this.capacity;
      toWrite = this.capacity;
    }

    const firstChunk = Math.min(toWrite, this.capacity - this.writeIndex);
    this.buffer.set(samples.subarray(start, start + firstChunk), this.writeIndex);
    if (firstChunk < toWrite) {
      this.buffer.set(samples.subarray(start + firstChunk, start + toWrite), 0);
      this.writeIndex = toWrite - firstChunk;
    } else {
      this.writeIndex = (this.writeIndex + firstChunk) % this.capacity;
    }
  }

  /** Copies the most recent `length` samples into `out` in chronological order. */
  readLatest(out: Float32Array, length: number): boolean {
    if (this.written < length || length > this.capacity) return false;
    const startIndex = (this.writeIndex - length + this.capacity) % this.capacity;
    const firstChunk = Math.min(length, this.capacity - startIndex);
    out.set(this.buffer.subarray(startIndex, startIndex + firstChunk), 0);
    if (firstChunk < length) {
      out.set(this.buffer.subarray(0, length - firstChunk), firstChunk);
    }
    return true;
  }

  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.written = 0;
  }
}
