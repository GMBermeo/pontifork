/**
 * Dual-rate pitch engine: turns a microphone stream into a frequency and a
 * confidence.
 *
 * Between them the three instruments span a bass's drop A (27.5 Hz) to the
 * upper frets of a guitar (~1 kHz): more than five octaves. One analysis
 * window cannot serve both ends: long enough for the bottom means a long lag
 * on everything, and short enough to feel instant up high cannot see a single
 * period down low. So the signal is analysed twice, in parallel, at two
 * rates, and an arbiter decides which branch to believe.
 *
 *   high band   16 kHz · 512-sample window ·   190–1000 Hz
 *   low  band    4 kHz · 512-sample window · floor–220 Hz
 *
 * The floor is set per instrument (see `detectionFloorHz`). The bands overlap
 * between 190 and 220 Hz on purpose, so the handover is a preference rather
 * than a cliff.
 */

import { Decimator, RingBuffer } from './decimate';
import { SpectralFluxGate } from './flux';
import { McLeodPitchDetector, PitchResult } from './mpm';

export interface PitchFrame {
  /** Fundamental in Hz; 0 when nothing is sounding. */
  frequency: number;
  clarity: number;
  rms: number;
  voiced: boolean;
  /** Which branch produced this reading. */
  band: 'high' | 'low' | 'none';
  /** True while an attack is being ridden out and the value is held over. */
  held: boolean;
  /** Monotonic sample count at the *end* of the analysis window. */
  sampleTime: number;
}

export interface PitchEngineOptions {
  sampleRate?: number;
  /** Highest fundamental the high band will report. */
  maxFrequency?: number;
  /** Lowest fundamental the low band will report, clamped to what its window can resolve. */
  minFrequency?: number;
  /** Clarity a high-band reading needs before the low band is skipped. */
  highBandConfidence?: number;
  /** Set false to skip the attack gate (useful in tests). */
  useOnsetGate?: boolean;
}

const HIGH_WINDOW = 512;
const HIGH_HOP = 128;
const LOW_WINDOW = 512;
const LOW_HOP = 64;
const DECIMATION = 4;

/**
 * Overlap region where either band may win; below it only the low band runs.
 * The low edge is 190 Hz rather than 180 so that the longest lag the high band
 * ever evaluates still fits two full periods inside its 512-sample window —
 * the NSDF's shrinking window makes estimates built from barely one period
 * noticeably noisier.
 */
const CROSSOVER_LOW_HZ = 190;
const CROSSOVER_HIGH_HZ = 220;

/**
 * How long a low-band reading stays usable. The low branch only produces a
 * result every other high hop (128 raw samples in yields 32 decimated, and a
 * low hop is 64), so without this the arbiter would see `null` on alternate
 * hops and publish "nothing sounding" over a perfectly good low note.
 */
const LOW_MAX_AGE_SAMPLES = HIGH_HOP * 4;

/** Two readings this close to a whole-number ratio are one note heard twice. */
const HARMONIC_TOLERANCE_CENTS = 60;
const MAX_HARMONIC = 8;

/**
 * How strongly the low band's window must repeat at the high band's period
 * for the high reading to be the note rather than one of its harmonics. A
 * genuinely periodic tone scores above 0.9 there; a low note with a strong
 * harmonic scores well under, because its fundamental and odd harmonics are
 * out of phase at that lag and pull the value down.
 */
const GENUINE_PERIOD_CLARITY = 0.8;

const SILENT_FRAME: PitchFrame = {
  frequency: 0, clarity: 0, rms: 0, voiced: false, band: 'none', held: false, sampleTime: 0,
};

type Choice = { result: PitchResult; band: 'high' | 'low' };

/** n when `higher` is a whole multiple n (2…8) of `lower` within tolerance; otherwise null. */
export function harmonicNumber(higher: number, lower: number): number | null {
  const ratio = higher / lower;
  const n = Math.round(ratio);
  if (n < 2 || n > MAX_HARMONIC) return null;
  return Math.abs(1200 * Math.log2(ratio / n)) <= HARMONIC_TOLERANCE_CENTS ? n : null;
}

export class PitchEngine {
  sampleRate: number;

  private readonly highBuffer: RingBuffer;
  private readonly lowBuffer: RingBuffer;
  private decimator: Decimator;
  private highDetector: McLeodPitchDetector;
  private lowDetector: McLeodPitchDetector;
  private gate: SpectralFluxGate | null;
  private readonly options: Required<Omit<PitchEngineOptions, 'sampleRate'>>;

  private readonly highFrame = new Float32Array(HIGH_WINDOW);
  private readonly lowFrame = new Float32Array(LOW_WINDOW);
  private readonly decimated = new Float32Array(4096);

  private highPending = 0;
  private lowPending = 0;
  private lastLow: { result: PitchResult; sampleTime: number } | null = null;

  private latest: PitchFrame = SILENT_FRAME;

  constructor(options: PitchEngineOptions = {}) {
    const {
      sampleRate = 16000, maxFrequency = 1000, minFrequency = 55,
      highBandConfidence = 0.88, useOnsetGate = true,
    } = options;

    this.options = { maxFrequency, minFrequency, highBandConfidence, useOnsetGate };
    this.sampleRate = sampleRate;

    this.highBuffer = new RingBuffer(HIGH_WINDOW * 4);
    this.lowBuffer = new RingBuffer(LOW_WINDOW * 4);
    this.decimator = new Decimator(sampleRate, DECIMATION);
    this.highDetector = this.buildHighDetector(sampleRate);
    this.lowDetector = this.buildLowDetector();
    this.gate = useOnsetGate ? new SpectralFluxGate(sampleRate, { fftSize: HIGH_WINDOW }) : null;
  }

  private buildHighDetector(sampleRate: number): McLeodPitchDetector {
    return new McLeodPitchDetector({
      sampleRate,
      windowSize: HIGH_WINDOW,
      minFrequency: CROSSOVER_LOW_HZ,
      maxFrequency: this.options.maxFrequency,
      clarityThreshold: 0.8,
    });
  }

  private buildLowDetector(): McLeodPitchDetector {
    const sampleRate = this.decimator.outputSampleRate;
    // One period must fit in the window with room to spare. At 16 kHz in
    // that allows anything down to 8 Hz; a device that insists on 48 kHz
    // still reaches 24 Hz, just short of what a drop-A five-string asks for.
    const resolvable = sampleRate / (LOW_WINDOW - 3);
    return new McLeodPitchDetector({
      sampleRate,
      windowSize: LOW_WINDOW,
      minFrequency: Math.max(this.options.minFrequency, resolvable),
      maxFrequency: CROSSOVER_HIGH_HZ,
      // The low band is where octave errors live, so it is held to a stricter
      // peak threshold: a subharmonic must be *much* taller to win.
      peakThreshold: 0.9,
      clarityThreshold: 0.78,
    });
  }

  /**
   * Retunes the engine when the hardware turns out to be running at a rate
   * other than the one we asked for — which it often does.
   *
   * Done in place rather than by constructing a new engine so that the React
   * layer does not need a piece of state whose only job is to trigger that
   * construction. Cheap, and a no-op when the rate is unchanged.
   */
  reconfigure(sampleRate: number): void {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return;
    if (sampleRate === this.sampleRate) return;

    this.sampleRate = sampleRate;
    this.decimator = new Decimator(sampleRate, DECIMATION);
    this.highDetector = this.buildHighDetector(sampleRate);
    this.lowDetector = this.buildLowDetector();
    this.gate = this.options.useOnsetGate
      ? new SpectralFluxGate(sampleRate, { fftSize: HIGH_WINDOW })
      : null;
    this.reset();
  }

  /** Feeds a block of mono float samples. Safe to call from an audio callback. */
  push(samples: Float32Array, count = samples.length): void {
    this.highBuffer.write(samples, count);
    this.highPending += count;

    const produced = this.decimator.process(samples, count, this.decimated);
    if (produced > 0) {
      this.lowBuffer.write(this.decimated, produced);
      this.lowPending += produced;
    }

    this.drain();
  }

  /** Most recent published frame. Cheap; call it once per render frame. */
  read(): PitchFrame {
    return this.latest;
  }

  reset(): void {
    this.highBuffer.reset();
    this.lowBuffer.reset();
    this.decimator.reset();
    this.gate?.reset();
    this.highPending = 0;
    this.lowPending = 0;
    this.lastLow = null;
    this.latest = SILENT_FRAME;
  }

  private drain(): void {
    while (this.highPending >= HIGH_HOP) {
      this.highPending -= HIGH_HOP;
      if (!this.highBuffer.readLatest(this.highFrame, HIGH_WINDOW)) continue;

      const attacking = this.gate ? this.gate.push(this.highFrame, HIGH_HOP) : false;
      const high = this.highDetector.detect(this.highFrame);

      const needLowBand = !high.voiced
        || high.clarity < this.options.highBandConfidence
        || high.frequency < CROSSOVER_HIGH_HZ;

      if (needLowBand && this.lowPending >= LOW_HOP) {
        this.lowPending %= LOW_HOP;
        if (this.lowBuffer.readLatest(this.lowFrame, LOW_WINDOW)) {
          this.lastLow = {
            result: this.lowDetector.detect(this.lowFrame),
            sampleTime: this.highBuffer.written,
          };
        }
      }

      const fresh = this.lastLow !== null
        && this.highBuffer.written - this.lastLow.sampleTime <= LOW_MAX_AGE_SAMPLES;

      this.publish(high, fresh ? this.lastLow!.result : null, attacking);
    }

    // Keep the low branch's pending count from running away when the high
    // branch never asks for it.
    if (this.lowPending > LOW_HOP * 4) this.lowPending = LOW_HOP;
  }

  private publish(high: PitchResult, low: PitchResult | null, attacking: boolean): void {
    const sampleTime = this.highBuffer.written;

    // Mid-attack the detector is looking at scratch, not a note. Freeze rather
    // than flicker — a needle that jumps on every bow change or pluck is worse
    // than one that waits 35 ms for the string to speak.
    if (attacking && this.latest.voiced) {
      this.latest = { ...this.latest, held: true, sampleTime };
      return;
    }

    const chosen = this.arbitrate(high, low);
    if (!chosen) {
      this.latest = {
        frequency: 0, clarity: Math.max(high.clarity, low?.clarity ?? 0),
        rms: high.rms, voiced: false, band: 'none', held: false, sampleTime,
      };
      return;
    }

    this.latest = {
      frequency: chosen.result.frequency,
      clarity: chosen.result.clarity,
      rms: high.rms,
      voiced: true,
      band: chosen.band,
      held: false,
      sampleTime,
    };
  }

  private arbitrate(high: PitchResult, low: PitchResult | null): Choice | null {
    const highOk = high.voiced && high.frequency >= CROSSOVER_LOW_HZ;
    if (highOk && low?.voiced) return this.reconcile(high, low);
    if (highOk) return { result: high, band: 'high' };
    if (low?.voiced) return { result: low, band: 'low' };
    return null;
  }

  /**
   * Both bands heard something. When one reading is a whole multiple of the
   * other, exactly one of two things has happened:
   *
   * - the note is low and its fundamental weak (a cello's C2, a bass through
   *   a phone microphone), and the high band locked onto a harmonic; or
   * - the note is high (a guitar's top strings sit above the low band's
   *   220 Hz ceiling), and the low band, unable to see a period that short,
   *   reported a multiple of it — a subharmonic.
   *
   * The low band's own analysis tells them apart: a genuinely high note
   * repeats at the high band's period as well.
   */
  private reconcile(high: PitchResult, low: PitchResult): Choice {
    if (harmonicNumber(high.frequency, low.frequency) !== null) {
      const genuine = this.lowDetector.periodicityAt(high.frequency) >= GENUINE_PERIOD_CLARITY;
      return genuine ? { result: high, band: 'high' } : { result: low, band: 'low' };
    }
    if (high.frequency >= CROSSOVER_HIGH_HZ && high.clarity >= this.options.highBandConfidence) {
      return { result: high, band: 'high' };
    }
    return low.clarity >= high.clarity ? { result: low, band: 'low' } : { result: high, band: 'high' };
  }
}
