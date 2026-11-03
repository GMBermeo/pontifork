import { ChordBook, PageMeta, Screen } from '@components';

/** The chord book: every chord in the tuning in use, and the open sequence. */
export default function ChordsScreen() {
  return (
    <Screen>
      <PageMeta path="/chords" title="Chord book for guitar, bass and cello · Pontifork"
        description="120 chords whose shapes follow your tuning: half step down, drop D, open G, with a capo. Finger numbers, every note, and saved chord sequences." />
      <ChordBook />
    </Screen>
  );
}
