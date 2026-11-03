import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { playChord } from '@audio';
import {
  chordDiagram, describeShape, openNotes, takesCapo,
  type BookEntry, type BookShape, type ChordSetup, type DiagramModel, type DiagramOptions,
} from '@domain';
import {
  useA4, useAllPositions, useCapo, useChordSound, useDotLabels, useInstrument, useLeftHanded, useStringCount, useTuning,
} from '@state';

/** The instrument, strings, tuning and capo the book is drawn for. */
export function useChordSetup(): ChordSetup {
  const instrument = useInstrument();
  const strings = useStringCount();
  const tuning = useTuning();
  const capo = useCapo();
  const effectiveCapo = takesCapo(instrument) ? capo : 0;
  return useMemo(() => ({ instrument, strings, tuning, capo: effectiveCapo }), [instrument, strings, tuning, effectiveCapo]);
}

/** How diagrams are drawn: the book's display settings for the setup in use. */
export function useDiagramOptions(setup: ChordSetup): DiagramOptions {
  const labels = useDotLabels();
  const leftHanded = useLeftHanded();
  const allPositions = useAllPositions();
  return useMemo(() => ({
    labels, leftHanded, allPositions,
    fretted: setup.instrument !== 'cello',
    capo: setup.capo,
    tie: setup.tuning.spelling,
  }), [labels, leftHanded, allPositions, setup]);
}

export function diagramOf(entry: BookEntry, shape: BookShape, setup: ChordSetup, options: DiagramOptions): DiagramModel {
  return chordDiagram(shape, openNotes(setup), entry, entry.spelling, options);
}

/** Every string left out: the "shape" of a chord with none, drawn for its positions alone. */
export function noShape(strings: number): BookShape {
  const empty = Array.from({ length: strings }, () => null);
  return { frets: empty, fingers: empty, source: { kind: 'found' }, label: null, notes: empty };
}

/** `B, C shape. Not played; fret 3, finger 3; …` */
export function shapeDescription(entry: BookEntry, shape: BookShape): string {
  const name = [entry.symbol, shape.label].filter(Boolean).join(', ');
  return `${name}. ${describeShape(shape)}`;
}

/** Plays a shape, when the player has sound on. */
export function usePlayShape(): (shape: BookShape | undefined) => void {
  const sound = useChordSound();
  const instrument = useInstrument();
  const a4 = useA4();
  return (shape) => {
    if (sound && shape) playChord(shape.notes, instrument, a4);
  };
}

/**
 * Room to leave under content pinned to the bottom of a tab. On iOS each tab
 * has its own safe area, which includes the floating tab bar; Android's tab
 * view already sits above its bar, and on the web the bar is in the page.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom : 0;
}
