import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@theme';

/**
 * The tuner and the chord book: the system tab bar, Liquid Glass on iOS 26+
 * and a Material bar on Android, as Ponticello has. The web has its own bar
 * (`_layout.web.tsx`).
 */
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <NativeTabs tintColor={theme.chrome.accent} labelStyle={{ color: theme.chrome.dim }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'tuningfork', selected: 'tuningfork' }} md="tune" />
        <NativeTabs.Trigger.Label>Tuner</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chords">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Chords</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
