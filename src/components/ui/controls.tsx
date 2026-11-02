import React, { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleProp, View, ViewStyle, type KeyDownEvent } from 'react-native';

import { RADIUS, useTheme, type Chrome } from '@theme';

import { Icon, type IconName } from './Icon';
import { Num, Row, Title } from './primitives';

const PRESSED_OPACITY = 0.7;
const BUTTON_PRESSED_OPACITY = 0.75;
const DISABLED_OPACITY = 0.4;

type ControlFeedback = {
  events: {
    onFocus: () => void;
    onBlur: () => void;
    onHoverIn: () => void;
    onHoverOut: () => void;
  };
  hovered: boolean;
  focusStyle: ViewStyle | undefined;
};

/** Shared pointer and keyboard feedback. The outline never changes layout. */
export function useControlFeedback(): ControlFeedback {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return {
    events: {
      onFocus: () => setFocused(true), onBlur: () => setFocused(false),
      onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false),
    },
    hovered,
    focusStyle: focused ? {
      outlineStyle: 'solid', outlineWidth: 2, outlineOffset: -2,
      outlineColor: theme.chrome.accent,
    } : undefined,
  };
}

function pressOpacity(pressed: boolean, disabled: boolean): number {
  if (disabled) return DISABLED_OPACITY;
  return pressed ? BUTTON_PRESSED_OPACITY : 1;
}

// ─── Button ──────────────────────────────────────────────────────────────────

export type ButtonTone = 'default' | 'accent' | 'ghost';

type ButtonColors = { ink: string; background: string };

/** The three button styles of iOS: filled (`accent`), grey (`default`) and plain (`ghost`). */
function buttonColors(tone: ButtonTone, chrome: Chrome, hovered: boolean): ButtonColors {
  if (tone === 'accent') return { ink: chrome.onAccent, background: chrome.accent };
  if (tone === 'ghost') return { ink: chrome.accent, background: hovered ? chrome.fill : 'transparent' };
  return { ink: chrome.ink, background: hovered ? chrome.lineSoft : chrome.fill };
}

export type ButtonProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, icon, onPress, tone = 'default', disabled = false, style, accessibilityLabel }: ButtonProps) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const colors = buttonColors(tone, theme.chrome, feedback.hovered);
  return (
    <Pressable {...feedback.events} onPress={onPress} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }} aria-disabled={disabled}
      style={({ pressed }) => [{
        minHeight: theme.tap, justifyContent: 'center', ...theme.corners(RADIUS.pill),
        paddingHorizontal: theme.s(tone === 'ghost' ? 12 : 18), paddingVertical: theme.s(10),
        backgroundColor: colors.background,
        opacity: pressOpacity(pressed, disabled),
      }, style, feedback.focusStyle]}>
      <Row gap={8} style={{ justifyContent: 'center' }}>
        {icon ? <Icon name={icon} size={15} color={colors.ink} /> : null}
        {label ? <Title size={15} color={colors.ink} style={{ flexShrink: 1 }}>{label}</Title> : null}
      </Row>
    </Pressable>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

export type StepperProps = {
  label: string;
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
};

export function Stepper({ label, display, onDecrement, onIncrement, canDecrement = true, canIncrement = true }: StepperProps) {
  const theme = useTheme();
  const stepStyle: ViewStyle = { paddingHorizontal: 0, minWidth: theme.tap, alignItems: 'center' };
  return (
    <Row style={{ ...theme.corners(RADIUS.pill), backgroundColor: theme.chrome.fill }}>
      <Button label="" icon="minus" accessibilityLabel={`Lower ${label}`} onPress={onDecrement} disabled={!canDecrement} tone="ghost" style={stepStyle} />
      <View accessibilityLabel={`${label}: ${display}`} style={{ minWidth: theme.s(72), alignItems: 'center' }}>
        <Num size={15}>{display}</Num>
      </View>
      <Button label="" icon="plus" accessibilityLabel={`Raise ${label}`} onPress={onIncrement} disabled={!canIncrement} tone="ghost" style={stepStyle} />
    </Row>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export interface Segment<T extends string> { value: T; label: string }

const SEGMENT_NAVIGATION_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/** What a segment's ref points at: since RN 0.88 a host element, not a `View` class instance. */
type SegmentElement = ComponentRef<typeof Pressable>;

/** Index a radio-group key press moves to, wrapping at both ends. */
export function segmentIndexAfterKey(index: number, key: string, count: number): number {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  return (index + step + count) % count;
}

export type SegmentedProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
};

/** A capsule radio group that fills its row. Arrow keys move the selection on the web. */
export function Segmented<T extends string>({ segments, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const theme = useTheme();
  const buttons = useRef<(SegmentElement | null)[]>([]);
  const selectWithKeyboard = (index: number, key: string) => {
    const next = segmentIndexAfterKey(index, key, segments.length);
    onChange(segments[next].value);
    buttons.current[next]?.focus();
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', padding: theme.s(3), ...theme.corners(RADIUS.pill), backgroundColor: theme.chrome.fill, alignSelf: 'stretch' }}>
      {segments.map((segment, index) => (
        <SegmentButton key={segment.value} segment={segment} selected={segment.value === value}
          onPress={() => onChange(segment.value)}
          setRef={(node) => { buttons.current[index] = node; }}
          onArrow={(key) => selectWithKeyboard(index, key)} />
      ))}
    </View>
  );
}

type SegmentButtonProps<T extends string> = {
  segment: Segment<T>;
  selected: boolean;
  onPress: () => void;
  setRef: (node: SegmentElement | null) => void;
  onArrow: (key: string) => void;
};

/**
 * Arrow-key navigation, as a radio group has on the web. Since RN 0.88 key
 * events are part of React Native itself (hardware keyboards on iPad and
 * Android), and react-native-web hands over the DOM event as `nativeEvent`, so
 * one handler serves every platform. Only the roving tab stop is web-only.
 */
function keyboardProps(selected: boolean, onArrow: (key: string) => void) {
  const tabStop: 0 | -1 = selected ? 0 : -1;
  return {
    tabIndex: Platform.OS === 'web' ? tabStop : undefined,
    onKeyDown: (event: KeyDownEvent) => {
      const { key } = event.nativeEvent;
      if (!SEGMENT_NAVIGATION_KEYS.includes(key)) return;
      event.preventDefault();
      onArrow(key);
    },
  };
}

function segmentBackground(selected: boolean, hovered: boolean, chrome: Chrome): string {
  if (selected) return chrome.dark ? chrome.line : chrome.surfaceElevated;
  return hovered ? chrome.lineSoft : 'transparent';
}

function SegmentButton<T extends string>({ segment, selected, onPress, setRef, onArrow }: SegmentButtonProps<T>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  return (
    <Pressable ref={setRef} {...feedback.events} onPress={onPress} accessibilityRole="radio"
      {...keyboardProps(selected, onArrow)}
      accessibilityLabel={segment.label} accessibilityState={{ checked: selected }} aria-checked={selected}
      style={({ pressed }) => [{
        flex: 1, minWidth: 0, minHeight: theme.tap - theme.s(6),
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.s(10),
        ...theme.corners(RADIUS.pill), backgroundColor: segmentBackground(selected, feedback.hovered, theme.chrome),
        boxShadow: selected && !theme.chrome.dark ? `0 ${theme.s(1)}px ${theme.s(5)}px rgba(0, 0, 0, 0.12)` : undefined,
        opacity: pressed ? PRESSED_OPACITY : 1,
      }, feedback.focusStyle]}>
      <Title size={14} color={selected ? theme.chrome.ink : theme.chrome.dim} style={{ textAlign: 'center' }}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{segment.label}</Title>
    </Pressable>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

export type PressableRowProps = {
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PressableRow({ onPress, accessibilityLabel, selected = false, children, style }: PressableRowProps) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  return (
    <Pressable {...feedback.events} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} aria-pressed={selected}
      style={({ pressed }) => [{
        minHeight: theme.tap,
        backgroundColor: selected || feedback.hovered ? theme.chrome.fill : 'transparent',
        opacity: pressed ? PRESSED_OPACITY : 1,
      }, style, feedback.focusStyle]}>
      {children}
    </Pressable>
  );
}
