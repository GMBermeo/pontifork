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

function distanceToString(frequency: number, context: TargetContext, index: number): number {
  return Math.abs(centsBetween(frequency, midiToFrequency(context.notes[index], context.a4)));
}

function isString(context: TargetContext, index: number | null): index is number {
  return index !== null && index >= 0 && index < context.notes.length;
}

/** The string nearest to `frequency`, held on the current one unless another is clearly closer. */
export function nearestString(frequency: number, context: TargetContext): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let index = 0; index < context.notes.length; index++) {
    const distance = distanceToString(frequency, context, index);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  if (best === null || bestDistance > STRING_CAPTURE_CENTS) return null;

  if (isString(context, context.current) && context.current !== best) {
    const held = distanceToString(frequency, context, context.current);
    if (held <= STRING_CAPTURE_CENTS && held - bestDistance < STRING_SWITCH_MARGIN_CENTS) return context.current;
  }
  return best;
}

/** The note the display should measure `frequency` against. */
export function resolveTarget(frequency: number, context: TargetContext): TunerTarget {
  if (isString(context, context.locked)) {
    return { stringIndex: context.locked, midi: context.notes[context.locked] };
  }
  const string = nearestString(frequency, context);
  if (string !== null) return { stringIndex: string, midi: context.notes[string] };
  return { stringIndex: null, midi: Math.round(frequencyToMidi(frequency, context.a4)) };
}
