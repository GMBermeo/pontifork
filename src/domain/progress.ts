/**
 * When a string counts as tuned.
 *
 * Sweeping a peg through the right pitch on the way past is not tuning it, so
 * a string is marked only after it has been held inside the in-tune window for
 * a moment. The same hold un-marks it: a tuned string later heard clearly off
 * loses its tick, because strings drift as their neighbours change tension.
 */

import { CLOSE_CENTS, IN_TUNE_CENTS } from './pitch';

/** How long a string must stay in (or out of) tune before its state changes. */
export const STATUS_HOLD_MS = 600;

export interface TuneSample {
  stringIndex: number | null;
  cents: number;
  voiced: boolean;
}

export interface StringStatusChange {
  stringIndex: number;
  tuned: boolean;
}

type Standing = { stringIndex: number; tuned: boolean };

/** In tune, clearly out of tune, or neither — the band between is too close to call. */
function standingOf(sample: TuneSample): Standing | null {
  if (!sample.voiced || sample.stringIndex === null) return null;
  const distance = Math.abs(sample.cents);
  if (distance <= IN_TUNE_CENTS) return { stringIndex: sample.stringIndex, tuned: true };
  if (distance > CLOSE_CENTS) return { stringIndex: sample.stringIndex, tuned: false };
  return null;
}

function sameStanding(a: Standing | null, b: Standing): boolean {
  return a !== null && a.stringIndex === b.stringIndex && a.tuned === b.tuned;
}

export class StringStatusTracker {
  private candidate: Standing | null = null;
  private since = 0;
  private reported = false;

  constructor(private readonly holdMs = STATUS_HOLD_MS) {}

  /** A change to report the moment a standing has been held for the hold time; otherwise null. */
  push(sample: TuneSample, nowMs: number): StringStatusChange | null {
    const standing = standingOf(sample);
    if (standing === null) {
      this.candidate = null;
      return null;
    }
    if (!sameStanding(this.candidate, standing)) {
      this.candidate = standing;
      this.since = nowMs;
      this.reported = false;
      return null;
    }
    if (this.reported || nowMs - this.since < this.holdMs) return null;
    this.reported = true;
    return { ...standing };
  }

  reset(): void {
    this.candidate = null;
    this.reported = false;
  }
}

/** The tuned strings after `change`: the same set when nothing changes, so React can skip a render. */
export function applyStatusChange(tuned: ReadonlySet<number>, change: StringStatusChange): ReadonlySet<number> {
  if (tuned.has(change.stringIndex) === change.tuned) return tuned;
  const next = new Set(tuned);
  if (change.tuned) next.add(change.stringIndex);
  else next.delete(change.stringIndex);
  return next;
}
