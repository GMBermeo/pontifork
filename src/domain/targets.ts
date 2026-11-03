/**
 * Which string a sounding pitch is aimed at.
 *
 * A chromatic tuner answers "what note is this?". A string tuner answers a
 * different question, "how far is this string from where it should be?",
 * and that needs a target even when the string is a long way off: someone
 * moving from standard to drop C has a low string four semitones above its
 * goal, and the display has to say "down", not "you are playing an E".
 */

import { centsBetween, frequencyToMidi, midiToFrequency } from './pitch';

/** Within this many cents of a string, a pitch is taken to be aimed at it. */
export const STRING_CAPTURE_CENTS = 450;

/**
 * In automatic mode, another string must be this many cents closer before the
 * target moves to it. Without the margin a pitch midway between two strings
 * flickers between them on every frame.
 */
export const STRING_SWITCH_MARGIN_CENTS = 40;

export interface TunerTarget {
  /** Index of the string aimed at, lowest first; null when reading chromatically. */
  stringIndex: number | null;
  /** The note aimed at: the string's open note, or the nearest semitone. */
  midi: number;
}

export interface TargetContext {
  /** The tuning's open-string MIDI notes, lowest first. */
  notes: readonly number[];
  a4: number;
  /** A string the player picked by hand. Automatic selection is off while set. */
  locked: number | null;
  /** The string automatic selection settled on last time, for hysteresis. */
  current: number | null;
}

function distanceToNote(frequency: number, note: number, a4: number): number {
  return Math.abs(centsBetween(frequency, midiToFrequency(note, a4)));
}

/** String `index` of the tuning as a target, or null when the tuning has no such string. */
function stringTarget(context: TargetContext, index: number | null): TunerTarget & { stringIndex: number } | null {
  if (index === null) return null;
  const midi = context.notes[index];
  return midi === undefined ? null : { stringIndex: index, midi };
}

/** The string nearest to `frequency`, held on the current one unless another is clearly closer. */
export function nearestString(frequency: number, context: TargetContext): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const [index, note] of context.notes.entries()) {
    const distance = distanceToNote(frequency, note, context.a4);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  if (best === null || bestDistance > STRING_CAPTURE_CENTS) return null;

  const held = stringTarget(context, context.current);
  if (held && held.stringIndex !== best) {
    const heldDistance = distanceToNote(frequency, held.midi, context.a4);
    if (heldDistance <= STRING_CAPTURE_CENTS && heldDistance - bestDistance < STRING_SWITCH_MARGIN_CENTS) return held.stringIndex;
  }
  return best;
}

/**
 * Every string a reading aimed at string `index` may come from. Strings in
 * unison (QOTSA's pairs) sound the same pitch, so while the tuner follows
 * whichever string is played it cannot tell them apart; a locked string is
 * only itself. Lowest first.
 */
export function candidateStrings(notes: readonly number[], index: number, locked: number | null): number[] {
  const note = notes[index];
  if (note === undefined) return [];
  if (locked !== null) return [index];
  return [...notes.keys()].filter((string) => notes[string] === note);
}

/** The note the display should measure `frequency` against. */
export function resolveTarget(frequency: number, context: TargetContext): TunerTarget {
  return stringTarget(context, context.locked)
    ?? stringTarget(context, nearestString(frequency, context))
    ?? { stringIndex: null, midi: Math.round(frequencyToMidi(frequency, context.a4)) };
}
