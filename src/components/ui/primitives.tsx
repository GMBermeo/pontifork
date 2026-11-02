import { useMemo } from 'react';
import { StyleProp, Text, TextProps, TextStyle, View, ViewProps, ViewStyle } from 'react-native';

import { bodyStyle, labelStyle, labelTracking, numberStyle, RADIUS, titleStyle, useTheme } from '@theme';

/**
 * Shared text, spacing and surfaces. Every size arrives in design units and
 * is converted through the theme, so a component never needs to know what
 * device it is on.
 */

// ─── Text ────────────────────────────────────────────────────────────────────

interface TypeProps extends TextProps {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** The uppercase tracked micro-label that heads every section. */
export function Label({ size = 12, color, style, children, ...rest }: TypeProps) {
  const theme = useTheme();
  const base = useMemo(() => {
    const fontSize = theme.font(size);
    return { ...labelStyle(theme, color), fontSize, letterSpacing: labelTracking(fontSize) };
  }, [theme, color, size]);
  return <Text {...rest} style={[base, style]}>{children}</Text>;
}

export function Title({ size = 24, color, style, children, ...rest }: TypeProps) {
  const theme = useTheme();
  const base = useMemo(() => titleStyle(theme, size, color), [theme, size, color]);
  return <Text {...rest} style={[base, style]}>{children}</Text>;
}

export function Body({ size = 16, color, style, children, ...rest }: TypeProps) {
  const theme = useTheme();
  const base = useMemo(() => bodyStyle(theme, size, color), [theme, size, color]);
  return <Text {...rest} style={[base, style]}>{children}</Text>;
}

/** Tabular figures, so a changing number does not shuffle the layout. */
export function Num({ size = 16, color, style, children, ...rest }: TypeProps) {
  const theme = useTheme();
  const base = useMemo(() => numberStyle(theme, size, color), [theme, size, color]);
  return <Text {...rest} style={[base, style]}>{children}</Text>;
}

// ─── Structure ───────────────────────────────────────────────────────────────

/** A hairline between rows. */
export function Rule({ color, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: theme.rule(1), alignSelf: 'stretch', backgroundColor: color ?? theme.chrome.lineSoft }, style]} />;
}

interface StackProps extends ViewProps {
  gap?: number;
  pad?: number;
  padX?: number;
  padY?: number;
  style?: StyleProp<ViewStyle>;
}

function useStackStyle(direction: 'row' | 'column', { gap = 0, pad, padX, padY }: StackProps): ViewStyle {
  const theme = useTheme();
  return useMemo<ViewStyle>(() => ({
    flexDirection: direction,
    alignItems: direction === 'row' ? 'center' : undefined,
    gap: theme.s(gap),
    padding: pad === undefined ? undefined : theme.s(pad),
    paddingHorizontal: padX === undefined ? undefined : theme.s(padX),
    paddingVertical: padY === undefined ? undefined : theme.s(padY),
  }), [theme, direction, gap, pad, padX, padY]);
}

export function Row({ gap, pad, padX, padY, style, children, ...rest }: StackProps) {
  const base = useStackStyle('row', { gap, pad, padX, padY });
  return <View {...rest} style={[base, style]}>{children}</View>;
}

export function Stack({ gap, pad, padX, padY, style, children, ...rest }: StackProps) {
  const base = useStackStyle('column', { gap, pad, padX, padY });
  return <View {...rest} style={[base, style]}>{children}</View>;
}

export function Grow() {
  return <View style={GROW} />;
}

const GROW: ViewStyle = { flex: 1 };

// ─── Surfaces ────────────────────────────────────────────────────────────────

/** A grouped card: the unit of content on every screen. */
export function Card({ gap = 0, pad = 16, style, children, ...rest }: StackProps) {
  const theme = useTheme();
  const base = useMemo<ViewStyle>(() => ({
    backgroundColor: theme.chrome.surface,
    ...theme.corners(RADIUS.lg),
    gap: theme.s(gap),
    padding: theme.s(pad),
    borderWidth: theme.chrome.dark ? theme.rule(1) : 0,
    borderColor: theme.chrome.lineSoft,
  }), [theme, gap, pad]);
  return <View {...rest} style={[base, style]}>{children}</View>;
}
