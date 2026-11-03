/**
 * What the player sees of their string, decided frame by frame: the needle's
 * cents, the level meter, and a throttled reading for text.
 *
 * Pure policy — no React, no microphone. `usePitch` is the adapter that feeds
 * it samples and writes its updates into shared values; tests feed it frames.
 */

import {
  centsBetween, DEFAULT_A4_HZ, frequencyToMidi, midiToFrequency, resolveTarget,
} from '@domain';

import { PitchEngine, type PitchFrame } from './PitchEngine';
import { TunerPitchSmoother, type PitchSample, type SmoothedPitch } from './smoothing';

export interface TunerReading {
  voiced: boolean;
  frequency: number;
  /** Nearest semitone to what is sounding, whatever the target. */
  heardMidi: number | null;
  /** The note aimed at: a string of the tuning, or the nearest semitone. */
  targetMidi: number | null;
  /** Index of the targeted string, lowest first; null when reading chromatically. */
  stringIndex: number | null;
  /** Distance from the target, unsmoothed beyond the median. Positive is sharp. */
  cents: number;
  stability: number;
}

export const SILENT_READING: TunerReading = {
  voiced: false, frequency: 0, heardMidi: null, targetMidi: null, stringIndex: null, cents: 0, stability: 0,
};

/** What the tracker measures against. */
export interface TunerConfig {
  /** The tuning's open-string MIDI notes, lowest first. */
  notes: readonly number[];
  a4: number;
  /** A string picked by hand, or null to follow whichever string is played. */
  lockedString: number | null;
}

/** Where frames come from: the real `PitchEngine`, or a scripted source in tests. */
export interface FrameSource {
  readonly sampleRate: number;
  push(samples: Float32Array): void;
  read(): PitchFrame;
  reconfigure(sampleRate: number): void;
  reset(): void;
}

/** What one block of samples changes. */
export interface TunerUpdate {
  /** Input level, 0–1. */
  level: number;
  /** 1 while a note is being tracked. */
  tracking: 0 | 1;
  /** New needle position in cents, or null to leave it where it is. */
  cents: number | null;
  /** A reading to publish, or null when nothing should be published this frame. */
  reading: TunerReading | null;
}

export interface TunerTrackerOptions {
  source?: FrameSource;
  sampleRate?: number;
  /** Lowest fundamental to listen for; see `detectionFloorHz`. */
  minFrequency?: number;
}

/**
 * How often the React-visible reading updates.
 *
 * The engine publishes over a hundred frames a second. Re-rendering at that
 * rate would be pointless — nobody reads a note name changing that fast — and
 * would keep the JS thread permanently busy. The needle and the level meter
 * ride Reanimated shared values instead and move every audio frame without
 * touching React at all.
 */
const READING_INTERVAL_MS = 100;

/** Per-frame easing of the needle toward the median, so it glides rather than steps. */
const NEEDLE_EASE = 0.3;

/** Level as a log curve: linear RMS spends most of its range on the loudest tenth and shows nothing at practice volume. */
function levelFromRms(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return Math.max(0, Math.min(1, (db + 60) / 54));
}

export class TunerTracker {
  private readonly source: FrameSource;
  private readonly smoother = new TunerPitchSmoother();
  private config: TunerConfig = { notes: [], a4: DEFAULT_A4_HZ, lockedString: null };
  private currentString: number | null = null;
  private currentTarget: number | null = null;
  private needle = 0;
  private lastPublishMs = -Infinity;
  private publishedVoiced = false;

  constructor(options: TunerTrackerOptions = {}) {
    this.source = options.source ?? new PitchEngine({
      sampleRate: options.sampleRate ?? 16000,
      ...(options.minFrequency === undefined ? {} : { minFrequency: options.minFrequency }),
    });
  }

  /**
   * Measure against a new tuning, reference or string lock. The smoothing
   * window is kept: the same string is still sounding, it is only being
   * measured against a different goal.
   */
  configure(config: TunerConfig): void {
    this.config = config;
    this.currentString = null;
    this.currentTarget = null;
  }

  reconfigure(sampleRate: number): void {
    this.source.reconfigure(sampleRate);
  }

  /** Forget everything heard; the next published reading starts from silence. */
  reset(): void {
    this.source.reset();
    this.smoother.reset();
    this.currentString = null;
    this.currentTarget = null;
    this.publishedVoiced = false;
  }

  push(samples: Float32Array, nowMs: number): TunerUpdate {
    this.source.push(samples);
    const frame = this.source.read();
    const smoothed = this.smoother.push(this.sampleOf(frame), nowMs);
    const reading = smoothed.voiced ? this.measure(smoothed) : null;
    return {
      level: levelFromRms(frame.rms),
      tracking: frame.voiced ? 1 : 0,
      cents: reading ? this.needle : null,
      reading: this.throttled(nowMs, reading),
    };
  }

  private sampleOf(frame: PitchFrame): PitchSample | null {
    if (!frame.voiced || frame.frequency <= 0) return null;
    return { frequency: frame.frequency, midi: Math.round(frequencyToMidi(frame.frequency, this.config.a4)) };
  }

  private measure(smoothed: SmoothedPitch): TunerReading {
    const { notes, a4, lockedString } = this.config;
    const target = resolveTarget(smoothed.frequency, { notes, a4, locked: lockedString, current: this.currentString });
    const cents = centsBetween(smoothed.frequency, midiToFrequency(target.midi, a4));

    // A new target is a jump, not drift: snap the needle to it.
    if (target.midi === this.currentTarget) this.needle += NEEDLE_EASE * (cents - this.needle);
    else this.needle = cents;
    this.currentString = target.stringIndex;
    this.currentTarget = target.midi;

    return {
      voiced: true,
      frequency: smoothed.frequency,
      heardMidi: smoothed.midi,
      targetMidi: target.midi,
      stringIndex: target.stringIndex,
      // The true offset, not the eased needle: text that read the needle
      // would flash "in tune" as it swept through zero on the way past.
      cents,
      stability: smoothed.stability,
    };
  }

  /** At most one reading per interval; silence is published once, when a note stops. */
  private throttled(nowMs: number, next: TunerReading | null): TunerReading | null {
    if (nowMs - this.lastPublishMs < READING_INTERVAL_MS) return null;
    this.lastPublishMs = nowMs;
    if (next) {
      this.publishedVoiced = true;
      return next;
    }
    if (!this.publishedVoiced) return null;
    this.publishedVoiced = false;
    return SILENT_READING;
  }
}
