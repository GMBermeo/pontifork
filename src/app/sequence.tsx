import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { Button, PageMeta, Screen, ScreenHeader, SequenceView } from '@components';
import { useOpenSequence } from '@state';

/** The open sequence, every chord large, to play from. `?play=1` starts the play-through. */
export default function SequenceScreen() {
  const router = useRouter();
  const { play } = useLocalSearchParams<{ play?: string }>();
  const sequence = useOpenSequence();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/chords');
  };
  return (
    <Screen>
      <PageMeta path="/sequence" title={`${sequence?.name ?? 'Sequence'} · Pontifork`} indexed={false}
        description="A saved chord sequence, every chord large, to play from." />
      <ScreenHeader title={sequence?.name ?? 'Sequence'} inset={Platform.OS !== 'ios'}>
        <Button label="Done" tone="ghost" onPress={close} />
      </ScreenHeader>
      <SequenceView autoplay={play === '1'} onClose={close} />
    </Screen>
  );
}
