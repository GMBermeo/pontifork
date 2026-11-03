import { useRouter } from 'expo-router';
import { View } from 'react-native';

import type { LivePitch } from '@audio';
import {
  A4_MAX_HZ, A4_MIN_HZ, DEFAULT_A4_HZ, INSTRUMENT_ORDER, INSTRUMENTS, noteLetter, type InstrumentId, type Tuning,
} from '@domain';
import { settingsActions, useA4, useInstrument, useStringCount, useTuning } from '@state';
import { useTheme } from '@theme';

import {
  Body, Button, Card, Icon, Label, Num, PressableRow, Row, Segmented, Stack, Stepper, Title, type Segment,
} from '../ui';
import { LevelMeter } from './LevelMeter';

const INSTRUMENT_SEGMENTS: readonly Segment<InstrumentId>[] = INSTRUMENT_ORDER.map((id) => ({
  value: id, label: INSTRUMENTS[id].name,
}));

/** The instrument, and for guitar and bass how many strings it has. */
export function InstrumentPicker() {
  const instrument = useInstrument();
  const strings = useStringCount();
  const counts = INSTRUMENTS[instrument].stringCounts;
  const countSegments: readonly Segment<string>[] = counts.map((n) => ({ value: String(n), label: `${n} strings` }));
  return (
    <Stack gap={8}>
      <Segmented segments={INSTRUMENT_SEGMENTS} value={instrument} onChange={settingsActions.setInstrument} accessibilityLabel="Instrument" />
      {counts.length > 1 ? (
        <Segmented segments={countSegments} value={String(strings)}
          onChange={(value) => settingsActions.setStringCount(Number(value))} accessibilityLabel="Number of strings" />
      ) : null}
    </Stack>
  );
}

/** En spaces: a plain space all but disappears between the heavy rounded capitals. */
const LETTER_GAP = '\u2002';

/** Open-string letters, lowest first: `D A D G B E`. */
export function tuningLetters(tuning: Tuning): string {
  return tuning.notes.map((midi) => noteLetter(midi, tuning.spelling)).join(LETTER_GAP);
}

/** The tuning in use. Opens the full list. */
export function TuningCard() {
  const theme = useTheme();
  const router = useRouter();
  const tuning = useTuning();
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <PressableRow onPress={() => router.push('/tunings')} accessibilityLabel={`Tuning: ${tuning.name}, ${tuningLetters(tuning)}. Change tuning`}>
        <Row gap={12} pad={16}>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Label size={11}>Tuning</Label>
            <Title size={20} numberOfLines={1}>{tuning.name}</Title>
            <Num size={15} color={theme.chrome.dim}>{tuningLetters(tuning)}</Num>
          </Stack>
          <Body size={15} color={theme.chrome.accent}>Change</Body>
          <Icon name="forward" size={15} color={theme.chrome.accent} />
        </Row>
      </PressableRow>
    </Card>
  );
}

/** Concert pitch calibration. */
export function ReferencePitchCard() {
  const theme = useTheme();
  const a4 = useA4();
  return (
    <Card gap={10}>
      <Row gap={12}>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Label size={11}>Reference pitch</Label>
          <Body size={12} color={theme.chrome.dim}>A above middle C. 440 Hz is concert pitch; orchestras often sit at 442, baroque at 415.</Body>
        </Stack>
        <Stepper label="reference pitch" display={`A = ${a4} Hz`}
          onDecrement={() => settingsActions.setA4(a4 - 1)} onIncrement={() => settingsActions.setA4(a4 + 1)}
          canDecrement={a4 > A4_MIN_HZ} canIncrement={a4 < A4_MAX_HZ} />
      </Row>
      {a4 === DEFAULT_A4_HZ ? null : (
        <Button label="Reset to 440 Hz" tone="ghost" onPress={() => settingsActions.setA4(DEFAULT_A4_HZ)} style={{ alignSelf: 'flex-start' }} />
      )}
    </Card>
  );
}

/** The input meter, the button that opens the microphone on the web, and any error. */
export function MicCard({ pitch, onEnable }: Readonly<{ pitch: LivePitch; onEnable: (() => void) | null }>) {
  const theme = useTheme();
  const { mic } = pitch;
  return (
    <Card gap={10}>
      <LevelMeter level={pitch.level} height={16} label="Microphone input" />
      {onEnable === null ? null : (
        <View style={{ gap: theme.s(8) }}>
          <Body size={13} color={theme.chrome.dim}>The browser asks before a page can listen. Nothing is recorded or sent anywhere.</Body>
          <Button label="Enable microphone" icon="mic" tone="accent" onPress={onEnable} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
      {mic.error === null ? null : <Body size={13} color={theme.chrome.far}>{mic.error}</Body>}
      <Body size={12} color={theme.chrome.dim}>Tune each string, then check them all again: tightening one changes the pull on its neighbours.</Body>
    </Card>
  );
}
