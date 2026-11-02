import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { LivePitch, MicSource, TunerReading } from '@audio';
import {
  formatCents, IN_TUNE_CENTS, INSTRUMENTS, judgeTuning, noteLetter, noteName, octaveOf, stringNumeral,
  tuneDirection,
} from '@domain';
import { useTheme, verdictColor } from '@theme';

import { Body, Grow, Label, Num, Row, Title } from '../ui';
import type { TuningSession } from './session';

/** The meter spans ±50 cents, which is half a semitone either way. */
export const TUNER_SPAN_CENTS = 50;
const TICKS_CENTS = [-50, -25, 0, 25, 50];

/** Horizontal position, in percent of the dial, of a cents offset. */
export function dialPercent(cents: number): number {
  'worklet';
  return 50 + (cents / TUNER_SPAN_CENTS) * 50;
}

const DIRECTION_WORD = { up: 'TUNE UP', down: 'TUNE DOWN' } as const;

function idleLine(mic: MicSource, session: TuningSession): string {
  if (mic.live) return `${INSTRUMENTS[session.instrument].action} one string at a time`;
  if (mic.status === 'requesting') return 'Waiting for the microphone';
  if (mic.status === 'idle') return 'Microphone off';
  return 'Microphone unavailable';
}

/** Which string, what is actually sounding when that is a different note, and the frequency. */
function statusLine(reading: TunerReading, mic: MicSource, session: TuningSession): string {
  if (!reading.voiced) return idleLine(mic, session);
  const { tuning, instrument } = session;
  const parts = [reading.stringIndex === null
    ? 'Chromatic'
    : `String ${stringNumeral(instrument, reading.stringIndex, tuning.notes.length)}`];
  if (reading.heardMidi !== null && reading.heardMidi !== reading.targetMidi) {
    parts.push(`hearing ${noteName(reading.heardMidi, tuning.spelling)}`);
  }
  parts.push(`${reading.frequency.toFixed(1)} Hz`);
  return parts.join(' · ');
}

function verdictLabel(reading: TunerReading, mic: MicSource): string {
  if (!reading.voiced) return mic.live ? 'LISTENING' : 'MIC OFF';
  const direction = tuneDirection(reading.cents);
  return direction === null ? 'IN TUNE' : DIRECTION_WORD[direction];
}

export type TunerDialProps = {
  pitch: LivePitch;
  reading: TunerReading;
  session: TuningSession;
};

/** The target note, the offset from it in cents, and a needle over a ±50 cent scale. */
export function TunerDial({ pitch, reading, session }: TunerDialProps) {
  const theme = useTheme();
  const { chrome } = theme;
  const color = reading.voiced ? verdictColor(judgeTuning(reading.cents), chrome) : chrome.dim;
  const inTuneInset = `${dialPercent(-IN_TUNE_CENTS)}%` as const;
  const target = reading.voiced ? reading.targetMidi : null;

  const needle = useAnimatedStyle(() => {
    const clamped = Math.max(-TUNER_SPAN_CENTS, Math.min(TUNER_SPAN_CENTS, pitch.cents.get()));
    return { left: `${dialPercent(clamped)}%` };
  });

  return (
    <View style={{ gap: theme.s(18) }}>
      <Row gap={16} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ alignItems: 'baseline' }}>
            <Title size={72} color={reading.voiced ? chrome.ink : chrome.dim} style={{ lineHeight: theme.font(80) }}
              accessibilityLabel={target === null ? 'No note' : `Target ${noteName(target, session.tuning.spelling)}`}>
              {target === null ? '—' : noteLetter(target, session.tuning.spelling)}
            </Title>
            {target === null ? null : <Title size={26} color={chrome.dim}>{octaveOf(target)}</Title>}
          </Row>
          <Body size={13} color={chrome.dim} numberOfLines={2}>{statusLine(reading, pitch.mic, session)}</Body>
        </View>
        <View style={{ alignItems: 'flex-end', paddingTop: theme.s(10) }}>
          <Num size={30} color={color}>{reading.voiced ? formatCents(reading.cents) : '—'}</Num>
          <Label size={11} color={color}>{verdictLabel(reading, pitch.mic)}</Label>
        </View>
      </Row>
      <View style={{ height: theme.s(60), borderBottomWidth: theme.rule(1), borderColor: chrome.line }}
        accessibilityRole="progressbar"
        accessibilityLabel={reading.voiced ? `${formatCents(reading.cents)} from target` : 'Not listening'}>
        <View style={{ position: 'absolute', left: inTuneInset, right: inTuneInset, top: 0, bottom: 0, backgroundColor: chrome.lineSoft }} />
        {TICKS_CENTS.map((value) => (
          <View key={value} style={{ position: 'absolute', left: `${dialPercent(value)}%`, bottom: 0, width: theme.rule(1), height: theme.s(value === 0 ? 60 : 18), backgroundColor: value === 0 ? chrome.ink : chrome.line }} />
        ))}
        {reading.voiced ? <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: theme.rule(3), marginLeft: -theme.rule(1.5), backgroundColor: color }, needle]} /> : null}
      </View>
      <Row>
        <Body size={12} color={chrome.dim}>Flat</Body><Grow />
        <Body size={12} color={chrome.dim}>In tune</Body><Grow />
        <Body size={12} color={chrome.dim}>Sharp</Body>
      </Row>
    </View>
  );
}
