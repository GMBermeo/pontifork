/**
 * A chord diagram as geometry: where the strings, frets, dots and labels go,
 * in a fixed coordinate space the component scales to fit. Pure, so what a
 * diagram shows is tested without drawing it.
 *
 * Strings stand upright with the lowest on the left (on the right when
 * mirrored for a left-handed player), the nut or capo at the top. Each dot
 * carries the finger to use or the note it sounds; the root is a square.
 * "All positions" also marks every other place the chord's notes fall up to
 * the twelfth fret, faded, so the shape still reads first.
 */

import { itemAt } from '../lists';
import { toPitchClass, type Spelling } from '../pitch';
import { chordPitchClasses, type ChordRef } from './chordTypes';
import { barresOf, stoppedRange, type ChordShape } from './shapes';
import { noteInChord, type NoteSpelling } from './spelling';

export type DotLabels = 'fingers' | 'notes';

export interface DiagramOptions {
  labels: DotLabels;
  leftHanded: boolean;
  allPositions: boolean;
  /** False for the cello: position lines instead of frets. */
  fretted: boolean;
  capo: number;
  /** Ties in note names (F♯ or G♭) go the tuning's way. */
  tie: Spelling;
}

export interface DiagramMarker {
  x: number;
  y: number;
  root: boolean;
  /** `shape`: part of the fingering. `related`: elsewhere on the neck. */
  role: 'shape' | 'related';
  text: string;
}

export interface DiagramModel {
  width: number;
  height: number;
  strings: { x: number; top: number; bottom: number }[];
  /** Horizontal lines, top first: the nut (or capo), then frets or positions. */
  lines: { y: number; left: number; right: number; kind: 'nut' | 'capo' | 'fret' | 'position' }[];
  /** The fret the top row is, when it is not the first: `5fr`. */
  startLabel: { x: number; y: number; text: string } | null;
  barres: { left: number; right: number; y: number }[];
  markers: DiagramMarker[];
  /** Above the nut: an open string (o, a square when it is the root) or one left out (×). */
  tops: { x: number; y: number; kind: 'open' | 'muted'; root: boolean }[];
  /** Under each sounded string, the note it sounds. */
  names: { x: number; y: number; text: string }[];
}

export const DIAGRAM = {
  stringGap: 22,
  fretGap: 26,
  left: 36,
  right: 14,
  top: 30,
  bottom: 26,
  dot: 9,
} as const;

/** The highest fret "All positions" reaches: past the octave everything repeats. */
export const ALL_POSITIONS_FRETS = 12;
/** Rows a diagram always shows, so a short shape is not drawn squashed. */
const MIN_ROWS = 4;
/** On the cello the board is drawn from the nut down to this many semitones at least. */
const MIN_CELLO_ROWS = 5;

/** The frets drawn: from `start`, `rows` of them. */
function visibleFrets(shape: Pick<ChordShape, 'frets'>, options: DiagramOptions): { start: number; rows: number } {
  const range = stoppedRange(shape.frets);
  if (options.allPositions) return { start: 1, rows: ALL_POSITIONS_FRETS };
  if (!options.fretted) return { start: 1, rows: Math.max(MIN_CELLO_ROWS, range?.high ?? 0) };
  if (!range || range.high <= MIN_ROWS) return { start: 1, rows: MIN_ROWS };
  return { start: range.low, rows: Math.max(MIN_ROWS, range.high - range.low + 1) };
}

/** Positions and names shared by every part of one diagram. */
interface Frame {
  open: readonly number[];
  start: number;
  rows: number;
  boardBottom: number;
  rootPc: number;
  xOf: (string: number) => number;
  yOf: (fret: number) => number;
  nameOf: (midi: number) => string;
}

/** The nut (or capo) and the fret or position lines under it. */
function boardLines(frame: Frame, options: DiagramOptions): DiagramModel['lines'] {
  const { top, fretGap } = DIAGRAM;
  const left = Math.min(frame.xOf(0), frame.xOf(frame.open.length - 1));
  const right = Math.max(frame.xOf(0), frame.xOf(frame.open.length - 1));
  let topKind: DiagramModel['lines'][number]['kind'] = 'fret';
  if (frame.start === 1) topKind = options.capo > 0 ? 'capo' : 'nut';
  const lines: DiagramModel['lines'] = [{ y: top, left, right, kind: topKind }];
  for (let row = 1; row <= frame.rows; row++) {
    lines.push({ y: top + row * fretGap, left, right, kind: options.fretted ? 'fret' : 'position' });
  }
  return lines;
}

/** The shape itself: its stops, what sounds open or not at all, and the notes under the strings. */
function shapeMarks(shape: Pick<ChordShape, 'frets' | 'fingers'>, frame: Frame, labels: DotLabels): Pick<DiagramModel, 'markers' | 'tops' | 'names'> {
  const { top } = DIAGRAM;
  const markers: DiagramMarker[] = [];
  const tops: DiagramModel['tops'] = [];
  const names: DiagramModel['names'] = [];
  // No shape at all (a chord out of reach, shown for its positions alone): nothing is "not played".
  const noShape = shape.frets.every((fret) => fret === null);
  shape.frets.forEach((fret, string) => {
    const x = frame.xOf(string);
    if (fret === null) {
      if (!noShape) tops.push({ x, y: top - 13, kind: 'muted', root: false });
      return;
    }
    const midi = itemAt(frame.open, string) + fret;
    const root = toPitchClass(midi) === frame.rootPc;
    names.push({ x, y: frame.boardBottom + 17, text: frame.nameOf(midi) });
    if (fret === 0) {
      tops.push({ x, y: top - 13, kind: 'open', root });
      return;
    }
    const text = labels === 'notes' ? frame.nameOf(midi) : String(shape.fingers[string] ?? '');
    markers.push({ x, y: frame.yOf(fret), root, role: 'shape', text });
  });
  return { markers, tops, names };
}

/** Every other place on the drawn board where one of the chord's notes falls. */
function relatedMarks(shape: Pick<ChordShape, 'frets'>, frame: Frame, chord: ChordRef, labels: DotLabels): DiagramMarker[] {
  const tones = new Set(chordPitchClasses(chord.root, chord.type));
  const marks: DiagramMarker[] = [];
  frame.open.forEach((note, string) => {
    for (let fret = Math.max(1, frame.start); fret < frame.start + frame.rows; fret++) {
      const pc = toPitchClass(note + fret);
      if (!tones.has(pc) || shape.frets[string] === fret) continue;
      marks.push({
        x: frame.xOf(string), y: frame.yOf(fret), root: pc === frame.rootPc, role: 'related',
        text: labels === 'notes' ? frame.nameOf(note + fret) : '',
      });
    }
  });
  return marks;
}

export function chordDiagram(
  shape: Pick<ChordShape, 'frets' | 'fingers'>,
  open: readonly number[],
  chord: ChordRef,
  root: NoteSpelling,
  options: DiagramOptions,
): DiagramModel {
  const count = open.length;
  const { start, rows } = visibleFrets(shape, options);
  const { stringGap, fretGap, left, right, top, bottom } = DIAGRAM;
  const boardBottom = top + rows * fretGap;
  const frame: Frame = {
    open, start, rows, boardBottom,
    rootPc: toPitchClass(chord.root),
    xOf: (string) => left + (options.leftHanded ? count - 1 - string : string) * stringGap,
    yOf: (fret) => top + (fret - start + 0.5) * fretGap,
    nameOf: (midi) => noteInChord(midi, root, chord.type, options.tie),
  };
  const own = shapeMarks(shape, frame, options.labels);
  // Neck-wide notes are drawn first, so the shape's own dots sit on top.
  const markers = options.allPositions ? [...relatedMarks(shape, frame, chord, options.labels), ...own.markers] : own.markers;
  const barres = barresOf(shape)
    .filter((barre) => barre.fret >= start && barre.fret < start + rows)
    .map((barre) => {
      const a = frame.xOf(barre.from);
      const b = frame.xOf(barre.to);
      return { left: Math.min(a, b), right: Math.max(a, b), y: frame.yOf(barre.fret) };
    });
  return {
    width: left + (count - 1) * stringGap + right,
    height: boardBottom + bottom,
    strings: Array.from({ length: count }, (_, string) => ({ x: frame.xOf(string), top, bottom: boardBottom })),
    lines: boardLines(frame, options),
    startLabel: start > 1 ? { x: left - 13, y: frame.yOf(start), text: `${start}fr` } : null,
    barres,
    markers,
    tops: own.tops,
    names: own.names,
  };
}

/** What a screen reader says for a shape: `Left out, 3, 2, open, 1, open`. */
export function describeShape(shape: Pick<ChordShape, 'frets' | 'fingers'>): string {
  return shape.frets
    .map((fret, string) => {
      if (fret === null) return 'not played';
      if (fret === 0) return 'open';
      const finger = shape.fingers[string];
      return finger === null || finger === undefined || finger === 0 ? `fret ${fret}` : `fret ${fret}, finger ${finger}`;
    })
    .join('; ');
}
