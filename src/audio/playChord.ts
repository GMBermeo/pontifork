import type { InstrumentId } from '@domain';

import { CHORD_SOUND, renderChord } from './chordSynth';
import { playSamples } from './playback/playSamples';
import { PLAYBACK_SAMPLE_RATE } from './playback/sampleRate';

/** Plays a chord's sounding notes, lowest string first, at the reference pitch. */
export function playChord(notes: readonly (number | null)[], instrument: InstrumentId, a4: number): void {
  const sounding = notes.filter((note): note is number => note !== null);
  if (sounding.length === 0) return;
  const samples = renderChord(sounding, { ...CHORD_SOUND[instrument], a4, sampleRate: PLAYBACK_SAMPLE_RATE });
  playSamples(samples, PLAYBACK_SAMPLE_RATE);
}
