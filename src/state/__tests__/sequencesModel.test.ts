import { describe, expect, it } from 'vitest';

import {
  addChord, clearSequence, createSequence, deleteSequence, EMPTY_SEQUENCES, MAX_CHORDS, moveChord, nextName,
  openSequence, removeChord, renameSequence, sameSetup, sanitizeSequences, selectSequence, setChordShape,
  type MadeFor, type SequenceChord, type SequencesState,
} from '../sequencesModel';
import { itemAt } from '../../domain/lists';

/** The open sequence's chords; fails the test when none is open. */
function openChords(state: SequencesState): readonly SequenceChord[] {
  const open = openSequence(state);
  if (!open) throw new Error('no sequence is open');
  return open.chords;
}

const STANDARD: MadeFor = { instrument: 'guitar', strings: 6, tuningId: 'standard', capo: 0 };
const DROP_D: MadeFor = { ...STANDARD, tuningId: 'drop-d' };

let ids = 0;
function add(state: SequencesState, root: number, madeFor: MadeFor = STANDARD): SequencesState {
  ids += 1;
  return addChord(state, { root, type: 'maj', shape: 0 }, { chord: `c${ids}`, sequence: `s${ids}` }, madeFor);
}

/** F, B, D: the example from the request. */
function fbd(): SequencesState {
  return add(add(add(EMPTY_SEQUENCES, 5), 11), 2);
}

const roots = (state: SequencesState) => openSequence(state)?.chords.map((chord) => chord.root);

describe('chord sequences', () => {
  it('starts a sequence with the first chord added, and keeps chords in the order they were added', () => {
    const state = fbd();
    expect(state.sequences).toHaveLength(1);
    expect(openSequence(state)?.name).toBe('Sequence 1');
    expect(roots(state)).toEqual([5, 11, 2]);
  });

  it('lets the same chord appear twice', () => {
    expect(roots(add(fbd(), 5))).toEqual([5, 11, 2, 5]);
  });

  it('remembers the setup its first chord was added in, not later ones', () => {
    const state = add(add(EMPTY_SEQUENCES, 0, DROP_D), 7, STANDARD);
    expect(openSequence(state)?.madeFor).toEqual(DROP_D);
  });

  it('moves, removes and clears chords', () => {
    const state = fbd();
    const f = itemAt(openChords(state), 0);
    const b = itemAt(openChords(state), 1);
    expect(roots(moveChord(state, b.id, -1))).toEqual([11, 5, 2]);
    expect(roots(moveChord(state, f.id, -1))).toEqual([5, 11, 2]);
    expect(roots(removeChord(state, b.id))).toEqual([5, 2]);
    expect(roots(clearSequence(state))).toEqual([]);
  });

  it('remembers the shape picked for a chord', () => {
    const state = fbd();
    const f = itemAt(openChords(state), 0);
    expect(itemAt(openChords(setChordShape(state, f.id, 2)), 0).shape).toBe(2);
  });

  it('keeps several sequences, one open at a time', () => {
    const two = createSequence(fbd(), 'second', STANDARD, 'Wonderwall');
    expect(openSequence(two)?.name).toBe('Wonderwall');
    expect(roots(add(two, 4))).toEqual([4]);
    const back = selectSequence(two, itemAt(two.sequences, 0).id);
    expect(roots(back)).toEqual([5, 11, 2]);
  });

  it('opens a neighbour when the open sequence is deleted', () => {
    const two = createSequence(fbd(), 'second', STANDARD);
    const state = deleteSequence(two, 'second');
    expect(state.sequences).toHaveLength(1);
    expect(roots(state)).toEqual([5, 11, 2]);
    expect(deleteSequence(state, itemAt(state.sequences, 0).id)).toEqual(EMPTY_SEQUENCES);
  });

  it('names new sequences by the first free number and ignores a blank rename', () => {
    const state = fbd();
    expect(nextName(state)).toBe('Sequence 2');
    const id = itemAt(state.sequences, 0).id;
    expect(openSequence(renameSequence(state, id, '   '))?.name).toBe('Sequence 1');
    expect(openSequence(renameSequence(state, id, '  Set 1 '))?.name).toBe('Set 1');
  });

  it('stops adding at the limit', () => {
    let state = EMPTY_SEQUENCES;
    for (let i = 0; i < MAX_CHORDS + 5; i++) state = add(state, i % 12);
    expect(openSequence(state)?.chords).toHaveLength(MAX_CHORDS);
  });

  it('compares setups by instrument, strings, tuning and capo', () => {
    expect(sameSetup(STANDARD, { ...STANDARD })).toBe(true);
    expect(sameSetup(STANDARD, DROP_D)).toBe(false);
    expect(sameSetup(STANDARD, { ...STANDARD, capo: 2 })).toBe(false);
  });
});

describe('sanitizeSequences', () => {
  it('reads back what it wrote', () => {
    const state = fbd();
    expect(sanitizeSequences(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('drops what it cannot read and falls back to the first sequence', () => {
    const state = sanitizeSequences({
      openId: 'gone',
      sequences: [
        { id: 'a', name: '', madeFor: { instrument: 'banjo' }, chords: [] },
        { id: 'b', name: 'Kept', madeFor: { instrument: 'bass', strings: 9, tuningId: 'nope', capo: 40 },
          chords: [{ id: 'x', root: 14, type: 'maj' }, { id: 'y', root: 0, type: 'add9' }, 'junk'] },
      ],
    });
    expect(state.openId).toBe('b');
    expect(state.sequences).toEqual([{
      id: 'b', name: 'Kept', madeFor: { instrument: 'bass', strings: 4, tuningId: 'standard', capo: 7 },
      chords: [{ id: 'x', root: 2, type: 'maj', shape: 0 }],
    }]);
    expect(sanitizeSequences('nonsense')).toEqual(EMPTY_SEQUENCES);
  });
});
