import { useRouter } from 'expo-router';
import { Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PageMeta, Screen, ScreenHeader, SequenceList } from '@components';
import { useTheme } from '@theme';

/** Every saved sequence, presented over the chord book. */
export default function SequencesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/chords');
  };
  return (
    <Screen>
      <PageMeta path="/sequences" title="Sequences · Pontifork" indexed={false}
        description="Chord sequences saved on this device: the chords of a song, in order." />
      <ScreenHeader title="Sequences" subtitle="Saved on this device" inset={Platform.OS !== 'ios'}>
        <Button label="Done" tone="ghost" onPress={close} />
      </ScreenHeader>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.s(16), paddingBottom: insets.bottom + theme.s(28) }}>
        <SequenceList onDone={close} />
      </ScrollView>
    </Screen>
  );
}
