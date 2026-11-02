import { describe, expect, it } from 'vitest';

import { centsBetween, midiToFrequency } from '@domain';

import type { PitchFrame } from '../PitchEngine';
import { SILENT_READING, TunerTracker, type FrameSource, type TunerReading } from '../tunerTracker';

/** A frame source that reports whatever frequency the test sets, one frame per push. */
class ScriptedSource implements FrameSource {
  readonly sampleRate = 16000;
  frequency = 0;
  private sampleTime = 0;

  push(samples: Float32Array): void {
    this.sampleTime += samples.length;
  }

  read(): PitchFrame {
    const voiced = this.frequency > 0;
    return {
      frequency: this.frequency, clarity: voiced ? 0.95 : 0, rms: voiced ? 0.1 : 0,
      voiced, band: 'low', held: false, sampleTime: this.sampleTime,
    };
  }

  reconfigure(): void {}
  reset(): void {}
}

const GUITAR = [40, 45, 50, 55, 59, 64];
const BLOCK = new Float32Array(128);
const FRAME_MS = 8;

function rig(notes = GUITAR, lockedString: number | null = null) {
  const source = new ScriptedSource();
  const tracker = new TunerTracker({ source });
  tracker.configure({ notes, a4: 440, lockedString });
  let now = 0;
  let last: TunerReading | null = null;
  const play = (frequency: number, ms: number) => {
    source.frequency = frequency;
    for (let t = 0; t < ms; t += FRAME_MS) {
      now += FRAME_MS;
      const update = tracker.push(BLOCK, now);
      if (update.reading) last = update.reading;
    }
    return last;
  };
  return { tracker, play };
}

const cents = (midi: number, offset: number) => midiToFrequency(midi) * Math.pow(2, offset / 1200);

describe('TunerTracker', () => {
  it('measures a string against its target in the tuning', () => {
    const reading = rig().play(cents(50, -12), 600);
    expect(reading).toMatchObject({ voiced: true, stringIndex: 2, targetMidi: 50, heardMidi: 50 });
    expect(reading?.cents).toBeCloseTo(-12, 0);
  });

  it('measures a locked string however far off it is', () => {
    const dropC = [36, 43, 48, 53, 57, 62];
    const reading = rig(dropC, 0).play(midiToFrequency(40), 600);
    expect(reading).toMatchObject({ stringIndex: 0, targetMidi: 36, heardMidi: 40 });
    expect(reading?.cents).toBeCloseTo(400, 0);
  });

  it('retargets when the tuning changes under a sounding string', () => {
    const { tracker, play } = rig();
    play(midiToFrequency(40), 400);
    tracker.configure({ notes: [38, 45, 50, 55, 59, 64], a4: 440, lockedString: null });
    const reading = play(midiToFrequency(40), 300);
    expect(reading).toMatchObject({ stringIndex: 0, targetMidi: 38 });
    expect(reading?.cents).toBeCloseTo(200, 0);
  });

  it('holds the reading through a short gap, then publishes silence once', () => {
    const { play } = rig();
    play(midiToFrequency(45), 400);
    expect(play(0, 200)?.voiced).toBe(true);
    expect(play(0, 800)).toEqual(SILENT_READING);
  });

  it('reports the true offset in text while the needle eases toward it', () => {
    const source = new ScriptedSource();
    const tracker = new TunerTracker({ source });
    tracker.configure({ notes: GUITAR, a4: 440, lockedString: null });
    const mismatches: string[] = [];
    let now = 0;
    for (const [offset, ms] of [[20, 700], [-12, 700]] as const) {
      source.frequency = cents(59, offset);
      for (let t = 0; t < ms; t += FRAME_MS) {
        now += FRAME_MS;
        const { reading } = tracker.push(BLOCK, now);
        if (!reading?.voiced || reading.targetMidi === null) continue;
        const truth = centsBetween(reading.frequency, midiToFrequency(reading.targetMidi));
        if (Math.abs(reading.cents - truth) > 0.01) mismatches.push(`${now}ms: ${reading.cents} vs ${truth}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('jumps straight to the next string rather than gliding', () => {
    const { play } = rig();
    play(midiToFrequency(40), 400);
    const reading = play(cents(55, 8), 200);
    expect(reading).toMatchObject({ stringIndex: 3 });
    expect(reading?.cents).toBeCloseTo(8, 0);
  });
});
