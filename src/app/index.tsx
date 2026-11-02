import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, LiveTuner, Screen, ScreenHeader, useAppActive, useKeepAwakeWhile } from '@components';
import { APP_NAME, APP_TAGLINE } from '@theme';

/**
 * The tuner.
 *
 * The microphone is open only while this screen is in front and the app is
 * active: opening the tuning list or switching away releases it, and the
 * screen is kept awake only while it listens.
 *
 * A browser opens a microphone only in response to a gesture, so on the web
 * listening starts with a button. That permission is held here rather than in
 * the tuner, so it outlives the tuning list unfocusing this screen.
 */
export default function TunerScreen() {
  const focused = useIsFocused();
  const appActive = useAppActive();
  const [micAllowed, setMicAllowed] = useState(Platform.OS !== 'web');
  const listening = micAllowed && focused && appActive;
  useKeepAwakeWhile(listening);

  return (
    <Screen>
      <ScreenHeader title={APP_NAME} subtitle={APP_TAGLINE}>
        {/* The product site is deployed beside the web app (see vercel.json). */}
        {Platform.OS === 'web'
          ? <Button label="Guide" tone="ghost" accessibilityLabel="How to use Pontifork" onPress={() => window.location.assign('/docs/')} />
          : null}
      </ScreenHeader>
      <LiveTuner listening={listening} onEnableMic={micAllowed ? null : () => setMicAllowed(true)} />
    </Screen>
  );
}
