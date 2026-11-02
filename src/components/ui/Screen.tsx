import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@theme';

import { Body, Title } from './primitives';

/**
 * Screen scaffold: the chrome's ground and the left and right safe-area
 * insets. The top inset belongs to the header and the bottom one to whatever
 * scrolls, so neither is applied here.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.chrome.bg, paddingLeft: insets.left, paddingRight: insets.right }, style]}>
      {children}
    </View>
  );
}

/**
 * A large title with an optional line under it and trailing actions beside
 * it. `inset` adds the status-bar inset above, for a screen at the top of the
 * window; a sheet presented over another screen passes false.
 */
export function ScreenHeader({
  title, subtitle, children, inset = true,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  inset?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const breathing = theme.s(Platform.OS === 'web' ? 18 : 6);
  const top = inset ? insets.top + breathing : theme.s(18);
  return (
    <View style={{ paddingTop: top, paddingHorizontal: theme.s(20), paddingBottom: theme.s(10), gap: theme.s(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.s(10), minHeight: theme.tap }}>
        <Title accessibilityRole="header" size={34} style={{ flex: 1 }} numberOfLines={1}>{title}</Title>
        {children}
      </View>
      {subtitle === undefined ? null : <Body size={15} color={theme.chrome.dim}>{subtitle}</Body>}
    </View>
  );
}
