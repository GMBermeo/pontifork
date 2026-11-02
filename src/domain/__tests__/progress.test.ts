import { describe, expect, it } from 'vitest';

import { applyStatusChange, StringStatusTracker, STATUS_HOLD_MS, type TuneSample } from '../progress';

describe('applyStatusChange', () => {
  it('adds and removes strings', () => {
    expect(applyStatusChange(new Set([0]), { stringIndex: 2, tuned: true })).toEqual(new Set([0, 2]));
    expect(applyStatusChange(new Set([0, 2]), { stringIndex: 0, tuned: false })).toEqual(new Set([2]));
  });

  it('returns the same set when nothing changes', () => {
    const tuned = new Set([1]);
    expect(applyStatusChange(tuned, { stringIndex: 1, tuned: true })).toBe(tuned);
    expect(applyStatusChange(tuned, { stringIndex: 3, tuned: false })).toBe(tuned);
  });
});

const inTune: TuneSample = { stringIndex: 2, cents: 3, voiced: true };
const wayOff: TuneSample = { stringIndex: 2, cents: -40, voiced: true };
const close: TuneSample = { stringIndex: 2, cents: 12, voiced: true };

/** Pushes `sample` every 100 ms for `ms`, returning every change reported. */
function hold(tracker: StringStatusTracker, sample: TuneSample, from: number, ms: number) {
  const changes = [];
  for (let t = from; t <= from + ms; t += 100) {
    const change = tracker.push(sample, t);
    if (change) changes.push(change);
  }
  return changes;
}

describe('StringStatusTracker', () => {
  it('marks a string tuned once it has been held in tune', () => {
    const tracker = new StringStatusTracker();
    expect(hold(tracker, inTune, 0, STATUS_HOLD_MS - 100)).toEqual([]);
    expect(hold(tracker, inTune, STATUS_HOLD_MS, 1000)).toEqual([{ stringIndex: 2, tuned: true }]);
  });

  it('un-marks a string held clearly off', () => {
    expect(hold(new StringStatusTracker(), wayOff, 0, 1000)).toEqual([{ stringIndex: 2, tuned: false }]);
  });

  it('ignores a pitch swept through on the way past', () => {
    const tracker = new StringStatusTracker();
    hold(tracker, inTune, 0, 300);
    expect(hold(tracker, close, 400, 1000)).toEqual([]);
    expect(hold(tracker, inTune, 1500, 300)).toEqual([]);
  });

  it('starts over on silence', () => {
    const tracker = new StringStatusTracker();
    hold(tracker, inTune, 0, 400);
    tracker.push({ ...inTune, voiced: false }, 500);
    expect(hold(tracker, inTune, 600, 400)).toEqual([]);
  });

  it('starts over when the string changes', () => {
    const tracker = new StringStatusTracker();
    hold(tracker, inTune, 0, 400);
    expect(hold(tracker, { ...inTune, stringIndex: 3 }, 500, 400)).toEqual([]);
  });
});
