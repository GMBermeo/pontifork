/**
 * Design tokens, inherited from Ponticello: iOS grouped surfaces (cards on a
 * soft grey ground in light, near-black in dark), continuous corners, capsule
 * controls and one indigo accent reserved for actions and selection. Green and
 * amber mean "in tune" and "close" and are never used for chrome. Nothing here
 * knows about screen size — see `scale.ts` for that.
 */

import type { TuningVerdict } from '@domain';

/**
 * Apple Human Interface Guidelines system colours, calibrated for light and
 * dark appearance with WCAG AA contrast.
 */
export const APPLE_HIG = {
  green: { accessibleLight: '#1F8A4C', dark: '#30D158' },
  yellow: { accessibleLight: '#9E7400', dark: '#FFD60A' },
  red: { accessibleLight: '#D70015', dark: '#FF453A' },
} as const;

/**
 * "Close" on a light ground. Apple's accessible orange (#C93400) is too near
 * its red for a dial that must tell "nearly there" from "way off" at a glance,
 * and its accessible yellow is 4.2:1 on white — short of AA for the small
 * verdict label. This amber is 5.3:1 and reads as neither.
 */
const AMBER_ON_LIGHT = '#8A6500';

export const BRAND = {
  /** The accent on light grounds: 7.5:1 on white. */
  indigo: '#4638D6',
  /** The accent lifted for dark grounds. */
  indigoLight: '#9C95FF',
  /** The splash ground and the dark chrome's floor. */
  midnight: '#0B0A14',
} as const;

export type ChromeName = 'paper' | 'quiet';

export interface Chrome {
  name: ChromeName;
  dark: boolean;
  /** The screen's ground — iOS's grouped background. */
  bg: string;
  /** Cards and grouped rows sitting on `bg`. */
  surface: string;
  /** The selected thumb of a segmented control. */
  surfaceElevated: string;
  /** Translucent control fill: segment tracks, grey buttons. */
  fill: string;
  ink: string;
  dim: string;
  line: string;
  lineSoft: string;
  accent: string;
  /** Text and glyphs drawn on a solid `accent` fill. */
  onAccent: string;
  accentWash: string;
  /** In tune. */
  good: string;
  /** Close: a fine adjustment away. */
  near: string;
  /** Clearly off. */
  far: string;
}

export const CHROMES: Record<ChromeName, Chrome> = {
  paper: {
    name: 'paper',
    dark: false,
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    fill: 'rgba(118, 118, 128, 0.12)',
    ink: '#111114',
    dim: '#636369',
    line: 'rgba(60, 60, 67, 0.36)',
    lineSoft: 'rgba(60, 60, 67, 0.14)',
    accent: BRAND.indigo,
    onAccent: '#FFFFFF',
    accentWash: 'rgba(70, 56, 214, 0.10)',
    good: APPLE_HIG.green.accessibleLight,
    near: AMBER_ON_LIGHT,
    far: APPLE_HIG.red.accessibleLight,
  },
  quiet: {
    name: 'quiet',
    dark: true,
    bg: BRAND.midnight,
    surface: '#18171F',
    surfaceElevated: '#25242E',
    fill: 'rgba(120, 120, 136, 0.24)',
    ink: '#F5F5F7',
    dim: '#9D9CA8',
    line: 'rgba(235, 235, 245, 0.30)',
    lineSoft: 'rgba(235, 235, 245, 0.12)',
    accent: BRAND.indigoLight,
    onAccent: BRAND.midnight,
    accentWash: 'rgba(156, 149, 255, 0.16)',
    good: APPLE_HIG.green.dark,
    near: APPLE_HIG.yellow.dark,
    far: APPLE_HIG.red.dark,
  },
};

/** Font sizes in design units — see `scale.ts`. */
export const TYPE = {
  micro: 12,
  small: 14,
  body: 16,
  title: 24,
  hero: 88,
} as const;

/** Tracking for the uppercase micro-labels that structure every screen. */
export const TRACKING = {
  label: 1.2,
  tight: -0.4,
} as const;

/**
 * Corner radii in design units. Drawn with continuous (squircle) corners on
 * iOS — see `corners()` in ThemeProvider.
 */
export const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 20, xl: 28,
  /** Large enough to make any control a capsule. */
  pill: 999,
} as const;

/** Minimum interactive size in design units. */
export const TAP_TARGET = 48;

/** The colour a tuning verdict is drawn in. */
export function verdictColor(verdict: TuningVerdict, chrome: Chrome): string {
  switch (verdict) {
    case 'in-tune': return chrome.good;
    case 'close': return chrome.near;
    case 'off': return chrome.far;
  }
}

/** `rgba` from a hex colour — RN has no `color-mix`. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
