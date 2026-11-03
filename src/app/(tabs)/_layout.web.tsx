import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Title, useControlFeedback } from '@components';
import { RADIUS, useTheme } from '@theme';

type TabButtonProps = TabTriggerSlotProps & { label: string };

/** One tab: a capsule, filled while its page is open. */
const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabButtonProps>(function TabButton({ label, isFocused, ...props }, ref) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const selected = isFocused === true;
  let background = feedback.hovered ? theme.chrome.fill : 'transparent';
  if (selected) background = theme.chrome.accentWash;
  return (
    <Pressable ref={ref} {...props} {...feedback.events} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected}
      style={({ pressed }) => [{
        flex: 1, minHeight: theme.tap, alignItems: 'center', justifyContent: 'center', ...theme.corners(RADIUS.pill),
        backgroundColor: background, opacity: pressed ? 0.7 : 1,
      }, feedback.focusStyle]}>
      <Title size={15} color={selected ? theme.chrome.accent : theme.chrome.dim}>{label}</Title>
    </Pressable>
  );
});

/**
 * The web's tab bar. Expo Router's native tabs draw a floating pill over the
 * top of the page in a browser, on top of the header; this one sits under the
 * page, where a phone's thumb expects it, in the app's own capsules.
 */
export default function WebTabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={{ flex: 1, backgroundColor: theme.chrome.bg }}>
      {/* Expo's slot will not shrink (flexShrink 0): bound it, so each page scrolls inside the window. */}
      <TabSlot style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 }} />
      <TabList asChild>
        <View accessibilityRole="tablist" style={{
          flexDirection: 'row', gap: theme.s(8), paddingHorizontal: theme.s(12), paddingTop: theme.s(6),
          paddingBottom: insets.bottom + theme.s(6), backgroundColor: theme.chrome.surface,
          borderTopWidth: theme.rule(1), borderTopColor: theme.chrome.lineSoft,
        }}>
          <TabTrigger name="index" href="/" asChild><TabButton label="Tuner" /></TabTrigger>
          <TabTrigger name="chords" href="/chords" asChild><TabButton label="Chords" /></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}
