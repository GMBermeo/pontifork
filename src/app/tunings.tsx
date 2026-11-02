import { useRouter } from 'expo-router';
import { Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Screen, ScreenHeader, TuningList } from '@components';
import { INSTRUMENTS, tuningsFor } from '@domain';
import { settingsActions, useInstrument, useStringCount, useTuning } from '@state';
import { useTheme } from '@theme';

/** Every tuning for the instrument and string count in use, presented over the tuner. */
export default function TuningsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const instrument = useInstrument();
  const strings = useStringCount();
  const tuning = useTuning();

  const { name, stringCounts } = INSTRUMENTS[instrument];
  const setup = stringCounts.length > 1 ? `${strings}-string ${name.toLowerCase()}` : name;
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen>
      {/* An iOS modal is a sheet below the status bar; elsewhere it fills the window. */}
      <ScreenHeader title="Tunings" subtitle={setup} inset={Platform.OS !== 'ios'}>
        <Button label="Done" tone="ghost" onPress={close} />
      </ScreenHeader>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.s(16), paddingBottom: insets.bottom + theme.s(28) }}>
        <TuningList tunings={tuningsFor(instrument, strings)} selectedId={tuning.id} onPick={(id) => {
          settingsActions.setTuning(id);
          close();
        }} />
      </ScrollView>
    </Screen>
  );
}
