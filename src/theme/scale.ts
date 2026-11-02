/**
 * Resolution model, inherited from Ponticello.
 *
 * Every size in the interface is written in design units against an
 * 829 × 690 canvas (the Galaxy Z Fold 5's inner display at its native
 * density). `useScale()` returns the factor mapping a design unit to a
 * device-independent pixel, plus how much of the canvas the window shows.
 *
 * The scale never goes below 1: the answer to a narrow window is to reflow,
 * not to shrink, so a phone gets a logically narrower canvas and `compact`
 * goes true. Above the canvas, a larger screen gets a proportionally larger
 * interface, up to a ceiling.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/** The design canvas every layout is written against, in design units. */
export const CANVAS = { width: 829, height: 690 } as const;

/** A design unit is never smaller than a point. */
export const MIN_SCALE = 1;
/** Above this, a very large screen stops magnifying and shows more instead. */
export const MAX_SCALE = 1.6;

/** Below this many design units of width the interface stacks into one column. */
export const COMPACT_BREAKPOINT = 620;

export interface ScaleInfo {
  /** Multiply a design unit by this to get device-independent pixels. */
  scale: number;
  /** How much of the canvas the window can show, in design units. */
  width: number;
  height: number;
  /** True on a phone or a narrow window. */
  compact: boolean;
}

export function computeScale(windowWidth: number, windowHeight: number): ScaleInfo {
  const fit = Math.min(windowWidth / CANVAS.width, windowHeight / CANVAS.height);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
  const width = windowWidth / scale;
  return { scale, width, height: windowHeight / scale, compact: width < COMPACT_BREAKPOINT };
}

export function useScale(): ScaleInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeScale(width, height), [width, height]);
}
