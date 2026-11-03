/**
 * Rolling-median smoother for a tuner's display.
 *
 * - A short history window filters attack transients and noise spikes.
 * - The median frequency of the window's dominant note ignores stray octave
 *   and harmonic readings rather than averaging them in.
 * - A hold between bow changes and plucks keeps the reading on screen while
 *   the string is re-excited.
 * - The window resets the moment a different note is played, so moving to the
 *   next string is instant.
 *
 * Only the frequency is smoothed. Which string that frequency is aimed at,
 * and how many cents off it is, are decided afterwards from this stable value,
 * so a noisy frame can never move the target.
 */

export interface PitchSample {
  frequency: number;
  /** The nearest semitone, used to bucket the window by note. */
  midi: number;
}

export interface SmoothedPitch {
  frequency: number;
  /** The note heard most often in the window. */
  midi: number;
  voiced: boolean;
  /** Share of the window that agrees with the dominant note, 0–1. */
  stability: number;
}

interface TimedSample extends PitchSample {
  time: number;
}

const SILENT: SmoothedPitch = { frequency: 0, midi: 0, voiced: false, stability: 0 };

/** Two semitones or more is a different note, not a string being tuned. */
const NEW_NOTE_SEMITONES = 2;

export class TunerPitchSmoother {
  private readonly windowMs: number;
  private readonly holdMs: number;
  private samples: TimedSample[] = [];
  private lastVoicedTime = 0;
  private currentMidi: number | null = null;

  constructor(windowMs = 600, holdMs = 450) {
    this.windowMs = windowMs;
    this.holdMs = holdMs;
  }

  /** Feeds one frame: a pitch, or null for silence. */
  push(sample: PitchSample | null, nowMs: number): SmoothedPitch {
    if (sample === null || sample.frequency <= 0) {
      if (this.samples.length > 0 && nowMs - this.lastVoicedTime < this.holdMs) return this.median();
      this.reset();
      return SILENT;
    }

    this.lastVoicedTime = nowMs;
    if (this.currentMidi !== null && Math.abs(sample.midi - this.currentMidi) >= NEW_NOTE_SEMITONES) {
      this.samples = [];
    }
    this.currentMidi = sample.midi;
    this.samples.push({ ...sample, time: nowMs });

    const cutoff = nowMs - this.windowMs;
    while ((this.samples[0]?.time ?? cutoff) < cutoff) this.samples.shift();

    return this.median();
  }

  reset(): void {
    this.samples = [];
    this.currentMidi = null;
    this.lastVoicedTime = 0;
  }

  /** The note heard most often; ties go to the one heard first. */
  private dominantMidi(latest: TimedSample): number {
    const counts = new Map<number, number>();
    for (const s of this.samples) counts.set(s.midi, (counts.get(s.midi) ?? 0) + 1);
    let dominant = latest.midi;
    let most = 0;
    for (const [midi, count] of counts) {
      if (count > most) {
        most = count;
        dominant = midi;
      }
    }
    return dominant;
  }

  private median(): SmoothedPitch {
    const latest = this.samples.at(-1);
    if (!latest) return SILENT;
    const midi = this.dominantMidi(latest);
    const agreeing = this.samples.filter((s) => s.midi === midi);
    const frequencies = agreeing.map((s) => s.frequency).sort((a, b) => a - b);
    const middle = Math.floor(frequencies.length / 2);
    // The dominant note is one of the samples, so there is always a middle one.
    const upper = frequencies[middle] ?? latest.frequency;
    const frequency = frequencies.length % 2 === 0 ? ((frequencies[middle - 1] ?? upper) + upper) / 2 : upper;
    return {
      frequency,
      midi,
      voiced: true,
      stability: Math.min(1, agreeing.length / Math.max(4, this.samples.length)),
    };
  }
}
