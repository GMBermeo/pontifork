import { Pressable, View } from 'react-native';

import { noteLetter, noteName, octaveOf, stringNumeral } from '@domain';
import { RADIUS, useTheme, type Chrome } from '@theme';

import { Body, Button, Grow, Icon, Label, Num, Row, Stack, Title, useControlFeedback } from '../ui';
import type { TuningSession } from './session';

interface PegState { active: boolean; locked: boolean; tuned: boolean }

function pegColors(state: PegState, chrome: Chrome) {
  if (state.locked) return { background: chrome.accent, ink: chrome.onAccent, border: chrome.accent };
  return {
    background: state.active ? chrome.accentWash : chrome.fill,
    ink: state.tuned ? chrome.good : chrome.ink,
    border: state.active ? chrome.accent : 'transparent',
  };
}

function Peg({ index, midi, state, session }: Readonly<{ index: number; midi: number; state: PegState; session: TuningSession }>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const { tuning, instrument } = session;
  const numeral = stringNumeral(instrument, index, tuning.notes.length);
  const colors = pegColors(state, theme.chrome);
  const description = [`String ${numeral}, ${noteName(midi, tuning.spelling)}`];
  if (state.tuned) description.push('tuned');
  if (state.locked) description.push('locked');

  return (
    <Pressable {...feedback.events}
      onPress={() => session.lockString(state.locked ? null : index)}
      accessibilityRole="button" accessibilityLabel={description.join(', ')}
      accessibilityHint={state.locked ? 'Follow whichever string is played' : 'Lock the tuner to this string'}
      accessibilityState={{ selected: state.locked }} aria-pressed={state.locked}
      style={({ pressed }) => [{
        flex: 1, minWidth: 0, minHeight: theme.tap + theme.s(16),
        alignItems: 'center', justifyContent: 'center', gap: theme.s(1),
        ...theme.corners(RADIUS.md), backgroundColor: colors.background,
        borderWidth: theme.rule(2), borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      }, feedback.focusStyle]}>
      <View style={{ height: theme.s(12), justifyContent: 'center' }}>
        {state.tuned && !state.locked ? <Icon name="check" size={11} color={theme.chrome.good} /> : null}
      </View>
      <Row style={{ alignItems: 'baseline' }}>
        <Title size={19} color={colors.ink} numberOfLines={1}>{noteLetter(midi, tuning.spelling)}</Title>
        <Num size={10} color={state.locked ? colors.ink : theme.chrome.dim}>{octaveOf(midi)}</Num>
      </Row>
      <Label size={10} color={state.locked ? colors.ink : theme.chrome.dim}>{numeral}</Label>
    </Pressable>
  );
}

/**
 * The tuning's strings, lowest on the left. The string being heard is
 * outlined, a string held in tune gets a tick, and tapping one locks the
 * tuner to it — for bringing a string a long way, where the nearest-string
 * guess would pick its neighbour.
 */
export function StringSelector({ session, activeString }: Readonly<{ session: TuningSession; activeString: number | null }>) {
  const theme = useTheme();
  const { lockedString, tuning, instrument } = session;
  const hint = lockedString === null
    ? 'Following whichever string you play. Tap a string to lock onto it.'
    : `Locked to string ${stringNumeral(instrument, lockedString, tuning.notes.length)}. Tap it again to follow any string.`;

  return (
    <Stack gap={12}>
      <Row gap={8} style={{ minHeight: theme.s(32) }}>
        <Label size={11}>Strings</Label>
        <Grow />
        {lockedString === null
          ? <Label size={11} color={theme.chrome.accent}>Auto</Label>
          : <Button label="Auto" tone="ghost" onPress={() => session.lockString(null)} accessibilityLabel="Follow whichever string is played" style={{ minHeight: theme.s(32), paddingVertical: 0 }} />}
      </Row>
      <View style={{ flexDirection: 'row', gap: theme.s(6) }}>
        {tuning.notes.map((midi, index) => (
          <Peg key={index} index={index} midi={midi} session={session} state={{
            active: activeString === index,
            locked: lockedString === index,
            tuned: session.tunedStrings.has(index),
          }} />
        ))}
      </View>
      <Body size={12} color={theme.chrome.dim}>{hint}</Body>
    </Stack>
  );
}
