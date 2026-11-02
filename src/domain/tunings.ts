/**
 * The tuning catalogue.
 *
 * Written out note by note rather than generated, so that anyone can read a
 * line and check it against a chart. `tunings.test.ts` checks the
 * relationships the names promise instead: every "half step down" is its
 * standard a semitone low on every string, every drop tuning is its standard
 * with the lowest string a whole tone down, and so on.
 */

import { INSTRUMENTS, type InstrumentId } from './instruments';
import { midiToFrequency, parseNote, type Spelling } from './pitch';

export type TuningFamily = 'standard' | 'drop' | 'open' | 'alternate' | 'scordatura';

export interface Tuning {
  /** Unique within its setup. Stored in settings, so never renamed. */
  id: string;
  name: string;
  family: TuningFamily;
  /** Open-string MIDI notes, lowest string first. */
  notes: readonly number[];
  spelling: Spelling;
  description: string;
}

/** An instrument with a given number of strings: `guitar-7`. */
export type SetupKey = `${InstrumentId}-${number}`;

export function setupKey(instrument: InstrumentId, strings: number): SetupKey {
  return `${instrument}-${strings}`;
}

export const TUNING_FAMILY_LABEL: Record<TuningFamily, string> = {
  standard: 'Standard and lowered',
  drop: 'Drop',
  open: 'Open',
  alternate: 'Alternate',
  scordatura: 'Scordatura',
};

export const TUNING_FAMILY_ORDER: readonly TuningFamily[] = ['standard', 'drop', 'open', 'alternate', 'scordatura'];

interface TuningSpec {
  id: string;
  name: string;
  family: TuningFamily;
  /** Space-separated, lowest string first, in scientific pitch: `E2 A2 D3`. */
  notes: string;
  spelling?: Spelling;
  description: string;
}

function tuning({ notes, spelling = 'sharps', ...rest }: TuningSpec): Tuning {
  return { ...rest, spelling, notes: notes.split(/\s+/).map(parseNote) };
}

// ─── Cello ───────────────────────────────────────────────────────────────────

const CELLO_4: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'C2 G2 D3 A3', description: 'C G D A, in perfect fifths.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'B1 F#2 C#3 G#3', description: 'Every string a semitone low, for playing with bands tuned to E♭.' }),
  tuning({ id: 'bach-suite-5', name: 'Bach Suite No. 5', family: 'scordatura', notes: 'C2 G2 D3 G3', description: 'The A string down to G, as Bach wrote it for the C minor suite.' }),
  tuning({ id: 'kodaly-op-8', name: 'Kodály Sonata, Op. 8', family: 'scordatura', notes: 'B1 F#2 D3 A3', description: 'The C and G strings down a semitone, for Kodály\'s solo sonata.' }),
];

// ─── Guitar ──────────────────────────────────────────────────────────────────

const GUITAR_6: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'E2 A2 D3 G3 B3 E4', description: 'E A D G B E. What nearly everything for guitar is written in.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4', spelling: 'flats', description: 'E♭ standard. Every string a semitone low.' }),
  tuning({ id: 'whole-step-down', name: 'Whole step down', family: 'standard', notes: 'D2 G2 C3 F3 A3 D4', description: 'D standard. Every string a whole tone low.' }),
  tuning({ id: 'c-sharp-standard', name: 'C♯ standard', family: 'standard', notes: 'C#2 F#2 B2 E3 G#3 C#4', description: 'One and a half steps down.' }),
  tuning({ id: 'c-standard', name: 'C standard', family: 'standard', notes: 'C2 F2 Bb2 Eb3 G3 C4', spelling: 'flats', description: 'Two whole steps down.' }),
  tuning({ id: 'b-standard', name: 'B standard', family: 'standard', notes: 'B1 E2 A2 D3 F#3 B3', description: 'Two and a half steps down: seven-string range on six strings.' }),
  tuning({ id: 'drop-d', name: 'Drop D', family: 'drop', notes: 'D2 A2 D3 G3 B3 E4', description: 'The low E down a whole tone: one-finger power chords.' }),
  tuning({ id: 'drop-c-sharp', name: 'Drop C♯', family: 'drop', notes: 'C#2 G#2 C#3 F#3 A#3 D#4', description: 'Drop D, half step down.' }),
  tuning({ id: 'drop-c', name: 'Drop C', family: 'drop', notes: 'C2 G2 C3 F3 A3 D4', description: 'Drop D, whole step down.' }),
  tuning({ id: 'drop-b', name: 'Drop B', family: 'drop', notes: 'B1 F#2 B2 E3 G#3 C#4', description: 'Drop D, one and a half steps down.' }),
  tuning({ id: 'drop-a-sharp', name: 'Drop A♯ / B♭', family: 'drop', notes: 'Bb1 F2 Bb2 Eb3 G3 C4', spelling: 'flats', description: 'Drop D, two whole steps down.' }),
  tuning({ id: 'drop-a', name: 'Drop A', family: 'drop', notes: 'A1 E2 A2 D3 F#3 B3', description: 'Drop D, two and a half steps down.' }),
  tuning({ id: 'double-drop-d', name: 'Double drop D', family: 'drop', notes: 'D2 A2 D3 G3 B3 D4', description: 'Both E strings down to D.' }),
  tuning({ id: 'open-d', name: 'Open D', family: 'open', notes: 'D2 A2 D3 F#3 A3 D4', description: 'The open strings ring a D major chord. A slide and folk staple.' }),
  tuning({ id: 'open-d-minor', name: 'Open D minor', family: 'open', notes: 'D2 A2 D3 F3 A3 D4', description: 'Open D with a minor third: the blues\' cross-note tuning.' }),
  tuning({ id: 'open-e', name: 'Open E', family: 'open', notes: 'E2 B2 E3 G#3 B3 E4', description: 'Open D a whole tone up: a bright E major chord for slide.' }),
  tuning({ id: 'open-g', name: 'Open G', family: 'open', notes: 'D2 G2 D3 G3 B3 D4', description: 'The open strings ring a G major chord.' }),
  tuning({ id: 'open-a', name: 'Open A', family: 'open', notes: 'E2 A2 E3 A3 C#4 E4', description: 'Open G a whole tone up.' }),
  tuning({ id: 'open-c', name: 'Open C', family: 'open', notes: 'C2 G2 C3 G3 C4 E4', description: 'A wide C major chord from low C to high E.' }),
  tuning({ id: 'dadgad', name: 'DADGAD', family: 'alternate', notes: 'D2 A2 D3 G3 A3 D4', description: 'A suspended, modal tuning from Celtic and acoustic guitar.' }),
];

const GUITAR_7: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'B1 E2 A2 D3 G3 B3 E4', description: 'B E A D G B E: six-string standard under a low B.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'Bb1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4', spelling: 'flats', description: 'B♭ standard. Every string a semitone low.' }),
  tuning({ id: 'whole-step-down', name: 'Whole step down', family: 'standard', notes: 'A1 D2 G2 C3 F3 A3 D4', description: 'A standard. Every string a whole tone low.' }),
  tuning({ id: 'drop-a', name: 'Drop A', family: 'drop', notes: 'A1 E2 A2 D3 G3 B3 E4', description: 'The low B down a whole tone: the seven-string drop D.' }),
  tuning({ id: 'drop-g-sharp', name: 'Drop G♯ / A♭', family: 'drop', notes: 'Ab1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4', spelling: 'flats', description: 'Drop A, half step down.' }),
  tuning({ id: 'drop-g', name: 'Drop G', family: 'drop', notes: 'G1 D2 G2 C3 F3 A3 D4', description: 'Drop A, whole step down.' }),
  tuning({ id: 'drop-f-sharp', name: 'Drop F♯', family: 'drop', notes: 'F#1 C#2 F#2 B2 E3 G#3 C#4', description: 'Drop A, one and a half steps down.' }),
];

// ─── Bass ────────────────────────────────────────────────────────────────────

const BASS_4: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'E1 A1 D2 G2', description: 'E A D G, an octave below the guitar\'s four lowest strings.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'Eb1 Ab1 Db2 Gb2', spelling: 'flats', description: 'E♭ standard. Every string a semitone low.' }),
  tuning({ id: 'whole-step-down', name: 'Whole step down', family: 'standard', notes: 'D1 G1 C2 F2', description: 'D standard. Every string a whole tone low.' }),
  tuning({ id: 'c-sharp-standard', name: 'C♯ standard', family: 'standard', notes: 'C#1 F#1 B1 E2', description: 'One and a half steps down.' }),
  tuning({ id: 'c-standard', name: 'C standard', family: 'standard', notes: 'C1 F1 Bb1 Eb2', spelling: 'flats', description: 'Two whole steps down.' }),
  tuning({ id: 'b-standard', name: 'B standard (BEAD)', family: 'standard', notes: 'B0 E1 A1 D2', description: 'A five-string\'s low B on four strings.' }),
  tuning({ id: 'drop-d', name: 'Drop D', family: 'drop', notes: 'D1 A1 D2 G2', description: 'The low E down a whole tone.' }),
  tuning({ id: 'drop-c-sharp', name: 'Drop C♯', family: 'drop', notes: 'C#1 G#1 C#2 F#2', description: 'Drop D, half step down.' }),
  tuning({ id: 'drop-c', name: 'Drop C', family: 'drop', notes: 'C1 G1 C2 F2', description: 'Drop D, whole step down.' }),
  tuning({ id: 'drop-b', name: 'Drop B', family: 'drop', notes: 'B0 F#1 B1 E2', description: 'Drop D, one and a half steps down.' }),
  tuning({ id: 'drop-a-sharp', name: 'Drop A♯ / B♭', family: 'drop', notes: 'Bb0 F1 Bb1 Eb2', spelling: 'flats', description: 'Drop D, two whole steps down.' }),
  tuning({ id: 'drop-a', name: 'Drop A', family: 'drop', notes: 'A0 E1 A1 D2', description: 'Drop D, two and a half steps down.' }),
  tuning({ id: 'tenor', name: 'Tenor (ADGC)', family: 'alternate', notes: 'A1 D2 G2 C3', description: 'Every string a fourth up, for chords and solos.' }),
];

const BASS_5: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'B0 E1 A1 D2 G2', description: 'B E A D G: four-string standard over a low B.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'Bb0 Eb1 Ab1 Db2 Gb2', spelling: 'flats', description: 'Every string a semitone low.' }),
  tuning({ id: 'whole-step-down', name: 'Whole step down', family: 'standard', notes: 'A0 D1 G1 C2 F2', description: 'Every string a whole tone low.' }),
  tuning({ id: 'drop-a', name: 'Drop A', family: 'drop', notes: 'A0 E1 A1 D2 G2', description: 'The low B down a whole tone.' }),
  tuning({ id: 'high-c', name: 'High C (EADGC)', family: 'alternate', notes: 'E1 A1 D2 G2 C3', description: 'Four-string standard with a high C in place of the low B.' }),
];

const BASS_6: readonly Tuning[] = [
  tuning({ id: 'standard', name: 'Standard', family: 'standard', notes: 'B0 E1 A1 D2 G2 C3', description: 'B E A D G C: a low B and a high C.' }),
  tuning({ id: 'half-step-down', name: 'Half step down', family: 'standard', notes: 'Bb0 Eb1 Ab1 Db2 Gb2 B2', spelling: 'flats', description: 'Every string a semitone low.' }),
  tuning({ id: 'whole-step-down', name: 'Whole step down', family: 'standard', notes: 'A0 D1 G1 C2 F2 Bb2', spelling: 'flats', description: 'Every string a whole tone low.' }),
  tuning({ id: 'drop-a', name: 'Drop A', family: 'drop', notes: 'A0 E1 A1 D2 G2 C3', description: 'The low B down a whole tone.' }),
];

// ─── Lookup ──────────────────────────────────────────────────────────────────

const CATALOGUE: Partial<Record<SetupKey, readonly Tuning[]>> = {
  'cello-4': CELLO_4,
  'guitar-6': GUITAR_6,
  'guitar-7': GUITAR_7,
  'bass-4': BASS_4,
  'bass-5': BASS_5,
  'bass-6': BASS_6,
};

/** Every tuning for an instrument strung with `strings` strings, standard first. */
export function tuningsFor(instrument: InstrumentId, strings: number): readonly Tuning[] {
  const tunings = CATALOGUE[setupKey(instrument, strings)];
  if (!tunings) throw new Error(`no tunings for a ${strings}-string ${instrument}`);
  return tunings;
}

/** The tuning with `id`, or the setup's standard tuning when there is none. */
export function findTuning(instrument: InstrumentId, strings: number, id: string | undefined): Tuning {
  const tunings = tuningsFor(instrument, strings);
  return tunings.find((t) => t.id === id) ?? tunings[0];
}

export interface TuningGroup {
  family: TuningFamily;
  tunings: readonly Tuning[];
}

/** Tunings grouped by family in display order, empty families left out. */
export function groupByFamily(tunings: readonly Tuning[]): TuningGroup[] {
  return TUNING_FAMILY_ORDER
    .map((family) => ({ family, tunings: tunings.filter((t) => t.family === family) }))
    .filter((group) => group.tunings.length > 0);
}

/**
 * How far below an instrument's lowest catalogued string the pitch engine
 * listens, in semitones: a string being brought up from slack, at the lowest
 * reference pitch, still has to register.
 */
const DETECTION_HEADROOM_SEMITONES = 3;
const LOWEST_REFERENCE_HZ = 415;

/** The lowest fundamental the pitch engine should look for when tuning this instrument. */
export function detectionFloorHz(instrument: InstrumentId): number {
  const lowest = Math.min(...INSTRUMENTS[instrument].stringCounts
    .flatMap((strings) => tuningsFor(instrument, strings))
    .map((t) => t.notes[0]));
  return midiToFrequency(lowest - DETECTION_HEADROOM_SEMITONES, LOWEST_REFERENCE_HZ);
}
