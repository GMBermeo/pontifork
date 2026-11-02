import { describe, expect, it } from 'vitest';

import { SpectralFluxGate } from '../flux';
import { PitchEngine } from '../PitchEngine';
import { tone } from './signals';

const HOP = 128;
const WINDOW = 512;

/** Runs `signal` through a gate hop by hop, returning what it said for each hop. */
function gateHops(signal: Float32Array, gate = new SpectralFluxGate(16000, { fftSize: WINDOW })): boolean[] {
  const verdicts: boolean[] = [];
  for (let end = WINDOW; end <= signal.length; end += HOP) verdicts.push(gate.push(signal.subarray(end - WINDOW, end), HOP));
  return verdicts;
}

function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Deterministic broadband noise: what a pick or a bow attack sounds like to the gate. */
function burst(seconds: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round(16000 * seconds));
  let state = 12345;
  for (let i = 0; i < out.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[i] = amplitude * (state / 0x100000000 - 0.5);
  }
  return out;
}

describe('SpectralFluxGate', () => {
  it('fires on an attack', () => {
    const verdicts = gateHops(concat(tone(110, { seconds: 0.5 }), burst(0.05), tone(110, { seconds: 0.2 })));
    const attackHop = Math.floor((0.5 * 16000 - WINDOW) / HOP);
    expect(verdicts.slice(attackHop, attackHop + 8)).toContain(true);
  });

  it('never holds a steady tone for most of the time', () => {
    const verdicts = gateHops(tone(146.83, { seconds: 2 }));
    expect(verdicts.filter(Boolean).length / verdicts.length).toBeLessThan(0.3);
  });
});

describe('PitchEngine with its attack gate', () => {
  it('follows a direct change between two sustained notes', () => {
    const engine = new PitchEngine({ minFrequency: 40 });
    const signal = concat(tone(146.83, { seconds: 1 }), tone(329.63, { seconds: 0.25 }));
    for (let at = 0; at + 256 <= signal.length; at += 256) engine.push(signal.subarray(at, at + 256));
    expect(engine.read().frequency).toBeCloseTo(329.63, 0);
  });
});
