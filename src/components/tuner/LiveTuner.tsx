import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePitch, useTunerReading } from '@audio';
import { detectionFloorHz } from '@domain';
import { useA4, useInstrument, useTuning } from '@state';
import { useTheme } from '@theme';

import { Card } from '../ui';
import { useStringLock, useTunedStrings, type TuningSession } from './session';
import { InstrumentPicker, MicCard, ReferencePitchCard, TuningCard } from './Setup';
import { StringSelector } from './StringSelector';
import { TunerDial } from './TunerDial';

/**
 * The tuner itself: the dial and the strings, beside the instrument, tuning,
 * microphone and reference-pitch settings. One column on a phone; on a wider
 * screen the dial gets the left side to itself.
 */
export function LiveTuner({ listening, onEnableMic }: Readonly<{
  listening: boolean;
  /** Opens the microphone where that needs a gesture (the web); null once it is open. */
  onEnableMic: (() => void) | null;
}>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const instrument = useInstrument();
  const tuning = useTuning();
  const a4 = useA4();
  const [lockedString, lockString] = useStringLock(tuning);

  const pitch = usePitch({
    enabled: listening,
    config: { notes: tuning.notes, a4, lockedString },
    minFrequency: detectionFloorHz(instrument),
  });
  const reading = useTunerReading(pitch);
  const tunedStrings = useTunedStrings(pitch, tuning, lockedString);
  const session: TuningSession = { instrument, tuning, lockedString, lockString, tunedStrings };

  const compact = theme.scale.compact;
  const tuner = (
    <>
      <Card><TunerDial pitch={pitch} reading={reading} session={session} /></Card>
      <Card><StringSelector session={session} activeString={reading.voiced ? reading.stringIndex : null} /></Card>
    </>
  );
  const setup = (
    <>
      <InstrumentPicker />
      <TuningCard />
      <MicCard pitch={pitch} onEnable={onEnableMic} />
      <ReferencePitchCard />
    </>
  );
  const gap = theme.s(14);

  return (
    <ScrollView contentContainerStyle={{ gap, paddingHorizontal: theme.s(16), paddingBottom: insets.bottom + theme.s(28) }}>
      {compact ? (
        <>
          <InstrumentPicker />
          <TuningCard />
          {tuner}
          <MicCard pitch={pitch} onEnable={onEnableMic} />
          <ReferencePitchCard />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.3, gap }}>{tuner}</View>
          <View style={{ flex: 1, gap }}>{setup}</View>
        </View>
      )}
    </ScrollView>
  );
}
