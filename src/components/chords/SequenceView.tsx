import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shapesFor, type ChordSetup, type DiagramOptions } from '@domain';
import { PLAY_THROUGH_MS, sameSetup, settingsActions, useOpenSequence, type SequenceChord } from '@state';
import { RADIUS, useTheme } from '@theme';

import { useKeepAwakeWhile } from '../tuner/session';
import { Body, Button, Label, Row, Stack, Title, useControlFeedback } from '../ui';
import { ChordDiagram } from './ChordDiagram';
import { madeForName, sequenceEntry } from './SequenceStrip';
import { diagramOf, shapeDescription, useChordSetup, useDiagramOptions, usePlayShape } from './useBook';

interface SequenceCardProps {
  chord: SequenceChord;
  setup: ChordSetup;
  options: DiagramOptions;
  width: number;
  current: boolean;
  step: number;
}

function noShapeLabel(symbol: string): string {
  return `${symbol}, no shape in this tuning`;
}

/** One chord of the sequence, drawn large. Tap to hear it. */
function SequenceCard({ chord, setup, options, width, current, step }: Readonly<SequenceCardProps>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const play = usePlayShape();
  const entry = useMemo(() => sequenceEntry(chord, setup), [chord, setup]);
  const shapes = useMemo(() => shapesFor(setup, entry), [setup, entry]);
  const shape = shapes[Math.min(chord.shape, shapes.length - 1)];
  const model = useMemo(() => (shape ? diagramOf(entry, shape, setup, options) : null), [entry, shape, setup, options]);
  return (
    <Pressable {...feedback.events} onPress={() => play(shape)} disabled={!shape}
      accessibilityRole="button" accessibilityState={{ selected: current }}
      accessibilityLabel={`${step}. ${shape ? shapeDescription(entry, shape) : noShapeLabel(entry.symbol)}. Play`}
      style={({ pressed }) => [{
        alignItems: 'center', gap: theme.s(4), padding: theme.s(10), ...theme.corners(RADIUS.lg),
        backgroundColor: current ? theme.chrome.accentWash : theme.chrome.surface,
        borderWidth: theme.rule(2), borderColor: current ? theme.chrome.accent : 'transparent',
        opacity: pressed ? 0.7 : 1,
      }, feedback.focusStyle]}>
      <Row gap={8} style={{ alignSelf: 'stretch' }}>
        <Body size={13} color={theme.chrome.dim}>{step}</Body>
        <Title size={24} style={{ flex: 1 }} numberOfLines={1}>{entry.symbol}</Title>
      </Row>
      {model ? (
        <ChordDiagram model={model} width={Math.min(width, (240 * model.width) / model.height)} accessibilityLabel={entry.symbol} />
      ) : (
        <Body size={13} color={theme.chrome.dim}>No shape within reach in this tuning.</Body>
      )}
      <Body size={12} color={theme.chrome.dim} numberOfLines={1}>{shape?.label ?? ' '}</Body>
    </Pressable>
  );
}

/** Play or stop, and where the play-through has got to. */
function PlayBar({ playing, count, onToggle }: Readonly<{ playing: number | null; count: number; onToggle: () => void }>) {
  const theme = useTheme();
  const seconds = PLAY_THROUGH_MS / 1000;
  const idle = playing === null;
  return (
    <Row gap={10} style={{ flexWrap: 'wrap' }}>
      <Button label={idle ? 'Play' : 'Stop'} icon={idle ? 'play' : 'stop'} tone="accent"
        accessibilityLabel={idle ? `Play through, one chord every ${seconds} seconds` : 'Stop'} onPress={onToggle} />
      <Body size={14} color={theme.chrome.dim} style={{ flex: 1, minWidth: theme.s(180) }} accessibilityLiveRegion="polite">
        {idle ? `${count} chords · one every ${seconds} seconds when played through` : `Chord ${playing + 1} of ${count}`}
      </Body>
    </Row>
  );
}

/** While playing: the chord to play now, large, and the one after it. */
function NowNext({ chords, playing, setup, options }: Readonly<{ chords: readonly SequenceChord[]; playing: number; setup: ChordSetup; options: DiagramOptions }>) {
  const theme = useTheme();
  const now = chords[playing];
  const next = chords[playing + 1];
  if (!now) return null;
  return (
    <Row gap={14} style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 2 }}>
        <Label size={11} style={{ marginBottom: theme.s(6) }}>Now</Label>
        <SequenceCard chord={now} setup={setup} options={options} width={260} current step={playing + 1} />
      </View>
      <View style={{ flex: 1 }}>
        {next ? (
          <>
            <Label size={11} style={{ marginBottom: theme.s(6) }}>Next</Label>
            <SequenceCard chord={next} setup={setup} options={options} width={120} current={false} step={playing + 2} />
          </>
        ) : null}
      </View>
    </Row>
  );
}

/**
 * The open sequence, every chord large, to play from. Play steps through the
 * chords at a steady pace without making a sound: it shows the change, the
 * player makes the music.
 */
export function SequenceView({ autoplay, onClose }: Readonly<{ autoplay: boolean; onClose: () => void }>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sequence = useOpenSequence();
  const setup = useChordSetup();
  const options = useDiagramOptions(setup);
  const chords = sequence?.chords ?? [];
  const [playing, setPlaying] = useState<number | null>(autoplay && chords.length > 0 ? 0 : null);
  // A tag of its own, so the tuner releasing its wake lock never ends this one.
  useKeepAwakeWhile(playing !== null, 'pontifork-sequence');

  useEffect(() => {
    if (playing === null) return;
    const timer = setTimeout(() => setPlaying((index) => {
      if (index === null) return null;
      return index + 1 < chords.length ? index + 1 : null;
    }), PLAY_THROUGH_MS);
    return () => clearTimeout(timer);
  }, [playing, chords.length]);

  const content = theme.scale.width - 32;
  const columns = Math.max(2, Math.min(5, Math.floor((content + 12) / (190 + 12))));
  const width = (content - 12 * (columns - 1)) / columns - 24;
  const current = { instrument: setup.instrument, strings: setup.strings, tuningId: setup.tuning.id, capo: setup.capo };
  const elsewhere = sequence !== null && !sameSetup(sequence.madeFor, current);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: theme.s(16), paddingBottom: insets.bottom + theme.s(28), gap: theme.s(14) }}>
      {sequence === null || chords.length === 0 ? (
        <Stack gap={8}>
          <Title size={20}>Nothing to show yet</Title>
          <Body color={theme.chrome.dim}>Add chords from the book with + and they appear here in order.</Body>
          <Row><Button label="Back to the book" onPress={onClose} /></Row>
        </Stack>
      ) : (
        <>
          <PlayBar playing={playing} count={chords.length} onToggle={() => setPlaying((index) => (index === null ? 0 : null))} />
          {elsewhere ? (
            <Row gap={8}>
              <Body size={14} color={theme.chrome.dim} style={{ flex: 1 }}>Made for {madeForName(sequence)}.</Body>
              <Button label="Switch" tone="ghost" onPress={() => {
                const { instrument, strings, tuningId, capo } = sequence.madeFor;
                settingsActions.setSetup(instrument, strings, tuningId, capo);
              }} />
            </Row>
          ) : null}
          {playing === null ? null : <NowNext chords={chords} playing={playing} setup={setup} options={options} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.s(12) }}>
            {chords.map((chord, index) => (
              <View key={chord.id} style={{ width: `${100 / columns - 2}%`, flexGrow: 1 }}>
                <SequenceCard chord={chord} setup={setup} options={options} width={width} current={index === playing} step={index + 1} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
