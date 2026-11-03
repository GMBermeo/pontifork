import { describe, expect, it } from 'vitest';

import { bookPage, openNotes, shapesFor, tuningRelation, type BookShape, type ChordSetup } from '../chords/book';
import { CHORD_TYPE_ORDER, chordPitchClasses, requiredPitchClasses, type ChordRef, type ChordTypeId } from '../chords/chordTypes';
import { chordDiagram, type DiagramOptions } from '../chords/diagram';
import { guitarShapes, sevenStringShapes } from '../chords/guitarShapes';
import { chordInKey, keyChords, keyName } from '../chords/keys';
import { MAX_SEARCH_FRET } from '../chords/search';
import { bassPitchClass, fingerShape, HAND_SPAN, soundsChord, stoppedRange } from '../chords/shapes';
import { chordRootSpelling, chordSymbol, chordToneSpellings, spellingName } from '../chords/spelling';
import { INSTRUMENT_ORDER, INSTRUMENTS, type InstrumentId } from '../instruments';
import { itemAt } from '../lists';
import { toPitchClass, type PitchClass } from '../pitch';
import { findTuning, tuningsFor, type Tuning } from '../tunings';

const ROOTS = Array.from({ length: 12 }, (_, root) => root);
const GUITAR_STANDARD = [40, 45, 50, 55, 59, 64];
const SEVEN_STANDARD = [35, 40, 45, 50, 55, 59, 64];

function setup(instrument: InstrumentId, strings: number, tuningId: string, capo = 0): ChordSetup {
  return { instrument, strings, tuning: findTuning(instrument, strings, tuningId), capo };
}

/** The book's first shape for a chord; fails the test when there is none. */
function firstShape(chords: ChordSetup, chord: ChordRef): BookShape {
  return itemAt(shapesFor(chords, chord), 0);
}

function everySetup(): { instrument: InstrumentId; strings: number; tuning: Tuning }[] {
  return INSTRUMENT_ORDER.flatMap((instrument) => INSTRUMENTS[instrument].stringCounts.flatMap((strings) =>
    tuningsFor(instrument, strings).map((tuning) => ({ instrument, strings, tuning }))));
}

/** Every shape the book shows, in every setup and tuning. */
function* everyBookShape() {
  for (const { instrument, strings, tuning } of everySetup()) {
    const chords: ChordSetup = { instrument, strings, tuning, capo: 0 };
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        for (const shape of shapesFor(chords, { root, type })) yield { chords, chord: { root, type }, shape };
      }
    }
  }
}

const frets = (pattern: string) => pattern.split('-').map((fret) => (fret === 'x' ? null : Number(fret)));

/** True when some choice of one note per string covers `required`, each string offering `options`. */
function covers(options: readonly (readonly PitchClass[])[], required: readonly PitchClass[], have: ReadonlySet<PitchClass> = new Set()): boolean {
  if (required.every((pc) => have.has(pc))) return true;
  const [first, ...rest] = options;
  if (first === undefined) return false;
  return covers(rest, required, have) || first.some((pc) => covers(rest, required, new Set([...have, pc])));
}

/**
 * Whether any hand could sound the chord in this tuning, under none of the
 * search's preferences (string count, unbroken runs, fingering): some window
 * of HAND_SPAN frets, open strings included, in which one chord tone per
 * string adds up to every tone the chord needs.
 */
function reachable(open: readonly number[], chord: ChordRef): boolean {
  const tones = new Set(chordPitchClasses(chord.root, chord.type));
  const required = requiredPitchClasses(chord.root, chord.type);
  for (let base = 1; base <= MAX_SEARCH_FRET; base++) {
    const window = [0, ...Array.from({ length: Math.min(HAND_SPAN, MAX_SEARCH_FRET - base) + 1 }, (_, i) => base + i)];
    const options = open.map((note) => [...new Set(window.map((fret) => toPitchClass(note + fret)))].filter((pc) => tones.has(pc)));
    if (covers(options, required)) return true;
  }
  return false;
}
const tones = (root: number, type: ChordTypeId) => chordToneSpellings(chordRootSpelling(root, type, 'sharps'), type, 'sharps').map(spellingName);

describe('the shapes guitarists learn', () => {
  it.each(CHORD_TYPE_ORDER)('every %s shape on six strings sounds the chord it is filed under', (type) => {
    for (const root of ROOTS) {
      for (const shape of guitarShapes(root, type)) {
        expect(soundsChord(shape.frets, GUITAR_STANDARD, { root, type }), `${root} ${type} ${shape.frets.join('-')}`).toBe(true);
      }
    }
  });

  it('puts the root in the bass of every barre', () => {
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        for (const shape of guitarShapes(root, type).filter((s) => s.source.kind === 'barre')) {
          expect(bassPitchClass(shape.frets, GUITAR_STANDARD)).toBe(root);
        }
      }
    }
  });

  it('gives every stopped string a finger, and only stopped strings', () => {
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        for (const shape of [...guitarShapes(root, type), ...sevenStringShapes(root, type)]) {
          shape.frets.forEach((fret, string) => {
            const finger = shape.fingers[string];
            if (fret === null) expect(finger).toBeNull();
            else if (fret === 0) expect(finger).toBe(0);
            else expect(finger).toBeGreaterThanOrEqual(1);
          });
          const range = stoppedRange(shape.frets);
          if (range) expect(range.high - range.low).toBeLessThanOrEqual(HAND_SPAN + 1);
        }
      }
    }
  });

  it('has an open shape, an E shape and an A shape for C major, the shapes on every chart', () => {
    expect(guitarShapes(0, 'maj').map((shape) => shape.frets.map((f) => f ?? 'x').join('-'))).toEqual([
      'x-3-2-0-1-0', 'x-3-5-5-5-3', '8-10-10-9-8-8',
    ]);
  });

  it('adds the E shape rooted on a seven-string\'s low B string', () => {
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        for (const shape of sevenStringShapes(root, type)) {
          expect(soundsChord(shape.frets, SEVEN_STANDARD, { root, type }), `${root} ${type} ${shape.frets.join('-')}`).toBe(true);
        }
      }
    }
    const low = sevenStringShapes(0, 'maj').find((shape) => shape.source.kind === 'barre' && shape.source.lowString === true);
    expect(low?.frets).toEqual(frets('1-3-3-2-x-x-x'));
  });
});

describe('the book follows the tuning', () => {
  it('sorts every tuning into the same-amount, drop or other family', () => {
    for (const { instrument, strings, tuning } of everySetup()) {
      const relation = tuningRelation({ instrument, strings, tuning, capo: 0 }).kind;
      const label = `${instrument}-${strings} ${tuning.id}`;
      if (tuning.family === 'standard') expect(relation, label).toBe('shift');
      if (tuning.family === 'drop' && tuning.id !== 'double-drop-d') expect(relation, label).toBe('drop');
      if (tuning.family === 'open' || tuning.family === 'scordatura') expect(relation, label).toBe('other');
    }
  });

  it('every shape in every tuning sounds the chord it is shown for, within one hand', () => {
    for (const { chords, chord, shape } of everyBookShape()) {
      const label = `${chords.instrument}-${chords.strings} ${chords.tuning.id} ${chord.root}${chord.type} ${shape.frets.join('-')}`;
      expect(soundsChord(shape.frets, openNotes(chords), chord), label).toBe(true);
      const range = stoppedRange(shape.frets);
      // A cellist's extended frame reaches a fourth fret above the first finger.
      const reach = chords.instrument === 'cello' ? 4 : HAND_SPAN;
      expect(range ? range.high - range.low : 0, label).toBeLessThanOrEqual(reach);
    }
  });

  it('has a shape for every chord on guitar and bass in every tuning whose strings are all different notes', () => {
    const distinct = everySetup().filter((s) => s.instrument !== 'cello' && new Set(s.tuning.notes).size === s.strings);
    for (const { instrument, strings, tuning } of distinct) {
      for (const type of CHORD_TYPE_ORDER) {
        for (const root of ROOTS) {
          expect(shapesFor({ instrument, strings, tuning, capo: 0 }, { root, type }).length, `${instrument}-${strings} ${tuning.id} ${root}${type}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('leaves a chord without a shape only when no hand can reach its notes', () => {
    // Strings in unison sound one note between them, so QOTSA's few distinct
    // strings cannot hold every chord: C augmented has no G or D, and every G
    // string fingers the same note in any one window, every D string another.
    for (const { instrument, strings, tuning } of everySetup()) {
      const chords: ChordSetup = { instrument, strings, tuning, capo: 0 };
      for (const type of CHORD_TYPE_ORDER) {
        for (const root of ROOTS) {
          if (shapesFor(chords, { root, type }).length > 0) continue;
          expect(reachable(openNotes(chords), { root, type }), `${instrument}-${strings} ${tuning.id} ${root}${type}`).toBe(false);
        }
      }
    }
  });

  it('has a shape for all twelve major and minor chords on the cello in standard tuning', () => {
    for (const type of ['maj', 'm'] as const) {
      for (const root of ROOTS) expect(shapesFor(setup('cello', 4, 'standard'), { root, type }).length, `${root}${type}`).toBeGreaterThan(0);
    }
  });

  it('turns the C shape into B a half step down, B♭ a whole step down, and D with a capo on 2', () => {
    const cShape = frets('x-3-2-0-1-0');
    const cases: [ChordSetup, number][] = [
      [setup('guitar', 6, 'half-step-down'), 11],
      [setup('guitar', 6, 'whole-step-down'), 10],
      [setup('guitar', 6, 'standard', 2), 2],
    ];
    for (const [chords, root] of cases) {
      const first = firstShape(chords, { root, type: 'maj' });
      expect(first.frets).toEqual(cShape);
      expect(first.label).toBe('C shape');
    }
  });

  it('names a shape only when it is not what it sounds', () => {
    expect(firstShape(setup('guitar', 6, 'standard'), { root: 0, type: 'maj' }).label).toBeNull();
    expect(firstShape(setup('guitar', 6, 'standard'), { root: 5, type: 'maj' }).label).toBe('E shape · fret 1');
  });

  it('keeps a half-step-down page in step with standard: every shape moves, none is lost', () => {
    const standard = setup('guitar', 6, 'standard');
    const lowered = setup('guitar', 6, 'half-step-down');
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        const same = shapesFor(lowered, { root: (root + 11) % 12, type }).map((shape) => shape.frets.join());
        expect(same).toEqual(shapesFor(standard, { root, type }).map((shape) => shape.frets.join()));
      }
    }
  });

  it('frets a drop tuning\'s low string two higher to keep the chord', () => {
    const g = shapesFor(setup('guitar', 6, 'drop-d'), { root: 7, type: 'maj' });
    expect(itemAt(g, 0).frets).toEqual(frets('5-2-0-0-0-3'));
    expect(itemAt(g, 0).label).toBe('G shape · low string +2');
  });

  it('leaves shapes that do not touch the low string as they are in drop D', () => {
    expect(firstShape(setup('guitar', 6, 'drop-d'), { root: 0, type: 'maj' }).frets).toEqual(frets('x-3-2-0-1-0'));
  });

  it('offers drop D\'s open and one-finger power chords', () => {
    expect(firstShape(setup('guitar', 6, 'drop-d'), { root: 2, type: '5' }).frets).toEqual(frets('0-0-0-x-x-x'));
    const e5 = firstShape(setup('guitar', 6, 'drop-d'), { root: 4, type: '5' });
    expect(e5.frets).toEqual(frets('2-2-2-x-x-x'));
    expect(e5.fingers).toEqual([1, 1, 1, null, null, null]);
  });

  it('finds open G\'s own shapes: all six strings open is G', () => {
    expect(firstShape(setup('guitar', 6, 'open-g'), { root: 7, type: 'maj' }).frets).toEqual(frets('0-0-0-0-0-0'));
  });

  it('rings G5 on QOTSA\'s open strings, and moves it up the neck with one finger', () => {
    expect(firstShape(setup('guitar', 6, 'qotsa'), { root: 7, type: '5' }).frets).toEqual(frets('0-0-0-0-0-0'));
    expect(firstShape(setup('guitar', 6, 'qotsa'), { root: 9, type: '5' }).frets).toEqual(frets('2-2-2-2-2-2'));
  });

  it('ignores a capo on the cello', () => {
    expect(openNotes(setup('cello', 4, 'standard', 3))).toEqual(findTuning('cello', 4, 'standard').notes);
  });
});

describe('spelling', () => {
  it('spells a chord\'s notes from its root', () => {
    expect(tones(11, 'maj')).toEqual(['B', 'D♯', 'F♯']);
    expect(tones(10, 'maj')).toEqual(['B♭', 'D', 'F']);
    expect(tones(3, 'm')).toEqual(['D♯', 'F♯', 'A♯']);
    expect(tones(1, 'm7')).toEqual(['C♯', 'E', 'G♯', 'B']);
    expect(tones(4, 'aug')).toEqual(['E', 'G♯', 'B♯']);
  });

  it('never writes a double sharp or flat', () => {
    for (const type of CHORD_TYPE_ORDER) {
      for (const root of ROOTS) {
        for (const tie of ['sharps', 'flats'] as const) {
          const names = chordToneSpellings(chordRootSpelling(root, type, tie), type, tie).map(spellingName);
          expect(names.join(' ')).not.toMatch(/𝄪|𝄫|♯♯|♭♭/);
        }
      }
    }
  });

  it('spells roots as charts do, with the tuning breaking ties', () => {
    const symbol = (root: number, type: ChordTypeId, tie: 'sharps' | 'flats') => chordSymbol(chordRootSpelling(root, type, tie), type);
    expect(symbol(1, 'maj', 'sharps')).toBe('D♭');
    expect(symbol(1, 'm', 'flats')).toBe('C♯m');
    expect(symbol(6, 'maj', 'sharps')).toBe('F♯');
    expect(symbol(6, 'maj', 'flats')).toBe('G♭');
    expect(symbol(3, 'dim', 'flats')).toBe('D♯dim');
  });
});

describe('keys', () => {
  it('lists C major\'s chords in degree order, triads then sevenths', () => {
    const page = bookPage('key', { tonic: 0, mode: 'major' }, 'sharps');
    expect(page.map((entry) => `${entry.symbol} ${entry.degree}`)).toEqual([
      'C I', 'Dm ii', 'Em iii', 'F IV', 'G V', 'Am vi', 'Bdim vii°',
      'Cmaj7 Imaj7', 'Dm7 ii7', 'Em7 iii7', 'Fmaj7 IVmaj7', 'G7 V7', 'Am7 vi7',
    ]);
  });

  it('gives a minor key its major V', () => {
    const a = { tonic: 9, mode: 'minor' } as const;
    expect(chordInKey(a, { root: 4, type: 'maj' }, 'sharps')?.degree).toBe('V');
    expect(chordInKey(a, { root: 4, type: '7' }, 'sharps')?.degree).toBe('V7');
    expect(chordInKey(a, { root: 4, type: 'm' }, 'sharps')?.degree).toBe('v');
  });

  it('spells a key\'s chords from the key', () => {
    const fSharp = keyChords({ tonic: 6, mode: 'major' }, 'sharps').map((chord) => chordSymbol(chord.spelling, chord.type));
    expect(fSharp.slice(0, 7)).toEqual(['F♯', 'G♯m', 'A♯m', 'B', 'C♯', 'D♯m', 'E♯dim']);
    expect(keyName({ tonic: 3, mode: 'minor' }, 'flats')).toBe('E♭ minor');
  });

  it('puts the key\'s chords of a type first on that type\'s page, then the rest from C', () => {
    const page = bookPage('maj', { tonic: 7, mode: 'major' }, 'sharps');
    expect(page.slice(0, 3).map((entry) => `${entry.symbol} ${entry.degree}`)).toEqual(['G I', 'C IV', 'D V']);
    expect(page).toHaveLength(12);
    expect(page.slice(3).every((entry) => entry.degree === null)).toBe(true);
  });
});

describe('fingering', () => {
  it('lays the index across a barre and fits the rest', () => {
    expect(fingerShape(frets('3-3-3-2-1-1'))).toEqual([3, 3, 3, 2, 1, 1]);
    expect(fingerShape(frets('1-3-3-2-1-1'))).toEqual([1, 3, 4, 2, 1, 1]);
  });

  it('fingers an open chord one finger per stop, in fret order', () => {
    expect(fingerShape(frets('x-3-2-0-1-0'))).toEqual([null, 3, 2, 0, 1, 0]);
  });

  it('refuses what one hand cannot reach', () => {
    expect(fingerShape(frets('1-x-x-x-x-6'))).toBeNull();
  });
});

describe('diagrams', () => {
  const c = firstShape(setup('guitar', 6, 'standard'), { root: 0, type: 'maj' });
  const base: DiagramOptions = { labels: 'fingers', leftHanded: false, allPositions: false, fretted: true, capo: 0, tie: 'sharps' };
  const draw = (options: Partial<DiagramOptions>) => chordDiagram(c, GUITAR_STANDARD, { root: 0, type: 'maj' }, chordRootSpelling(0, 'maj', 'sharps'), { ...base, ...options });

  it('marks the root with a square and labels each stop with its finger', () => {
    const model = draw({});
    expect(model.markers.map((marker) => [marker.text, marker.root])).toEqual([['3', true], ['2', false], ['1', true]]);
    expect(model.tops.map((top) => top.kind)).toEqual(['muted', 'open', 'open']);
    expect(model.names.map((name) => name.text)).toEqual(['C', 'E', 'G', 'C', 'E']);
  });

  it('labels stops with their notes when asked', () => {
    expect(draw({ labels: 'notes' }).markers.map((marker) => marker.text)).toEqual(['C', 'E', 'C']);
  });

  it('mirrors for a left-handed player', () => {
    const right = draw({}).strings.map((string) => string.x);
    const left = draw({ leftHanded: true }).strings.map((string) => string.x);
    expect(left).toEqual([...right].reverse());
  });

  it('marks every place the chord\'s notes fall up to the twelfth fret', () => {
    const model = draw({ allPositions: true });
    const related = model.markers.filter((marker) => marker.role === 'related');
    // Each string, frets 1–12: one octave, so each of C, E and G once — minus the shape's own three stops.
    expect(related).toHaveLength(6 * 3 - 3);
    expect(model.lines.filter((line) => line.kind === 'fret')).toHaveLength(12);
  });

  it('draws a capo where the nut would be', () => {
    expect(itemAt(draw({ capo: 2 }).lines, 0).kind).toBe('capo');
  });
});
