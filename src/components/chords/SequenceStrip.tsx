import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  chordName, chordRootSpelling, chordSymbol, DIAGRAM, findTuning, setupName, shapesFor, takesCapo,
  type BookEntry, type ChordSetup, type DiagramOptions,
} from '@domain';
import { sameSetup, sequenceActions, settingsActions, useOpenSequence, type ChordSequence, type SequenceChord } from '@state';
import { RADIUS, useTheme } from '@theme';

import { Body, Button, Icon, Label, Row, Title, useControlFeedback } from '../ui';
import { ChordDiagram } from './ChordDiagram';
import { diagramOf, shapeDescription, usePlayShape } from './useBook';

/** A sequence chord as a book entry: spelt outside any key, as the strip writes it. */
export function sequenceEntry(chord: SequenceChord, setup: ChordSetup): BookEntry {
  const spelling = chordRootSpelling(chord.root, chord.type, setup.tuning.spelling);
  return { root: chord.root, type: chord.type, spelling, symbol: chordSymbol(spelling, chord.type), degree: null };
}

/** `Bass · Drop D · Capo 2`. */
export function madeForName(sequence: ChordSequence): string {
  const { instrument, strings, tuningId, capo } = sequence.madeFor;
  const tuning = findTuning(instrument, strings, tuningId);
  return [setupName(instrument, strings), tuning.name, takesCapo(instrument) && capo > 0 ? `Capo ${capo}` : null]
    .filter(Boolean).join(' · ');
}

const MINI_HEIGHT = 64;

interface StripChordProps {
  chord: SequenceChord;
  setup: ChordSetup;
  options: DiagramOptions;
  editing: boolean;
  first: boolean;
  last: boolean;
}

function StripChord({ chord, setup, options, editing, first, last }: Readonly<StripChordProps>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const play = usePlayShape();
  const entry = useMemo(() => sequenceEntry(chord, setup), [chord, setup]);
  const shapes = useMemo(() => shapesFor(setup, entry), [setup, entry]);
  const shape = shapes[Math.min(chord.shape, shapes.length - 1)];
  // A compact diagram: the shape alone, without the neck-wide markings.
  const model = useMemo(() => {
    if (!shape) return null;
    const full = diagramOf(entry, shape, setup, { ...options, allPositions: false });
    // At this size the note names under the strings are noise; the chord's name is above it.
    return { ...full, names: [], height: full.height - DIAGRAM.bottom + 6 };
  }, [entry, shape, setup, options]);
  return (
    <View style={{ alignItems: 'center', gap: theme.s(2) }}>
      <Pressable {...feedback.events} onPress={() => play(shape)}
        accessibilityRole="button" accessibilityLabel={shape ? `${shapeDescription(entry, shape)}. Play` : `${entry.symbol}: no shape in this tuning`}
        style={({ pressed }) => [{
          alignItems: 'center', paddingHorizontal: theme.s(6), paddingTop: theme.s(4), ...theme.corners(RADIUS.md),
          backgroundColor: feedback.hovered ? theme.chrome.fill : 'transparent', opacity: pressed ? 0.7 : 1,
        }, feedback.focusStyle]}>
        <Title size={16} numberOfLines={1}>{entry.symbol}</Title>
        {model ? (
          <ChordDiagram model={model} width={(MINI_HEIGHT * model.width) / model.height} accessibilityLabel={entry.symbol} />
        ) : (
          <Body size={11} color={theme.chrome.dim} style={{ height: theme.s(MINI_HEIGHT), textAlignVertical: 'center' }}>no shape</Body>
        )}
      </Pressable>
      {editing ? (
        <Row gap={0}>
          <Button label="" icon="back" tone="ghost" accessibilityLabel={`Move ${entry.symbol} earlier`} disabled={first}
            onPress={() => sequenceActions.move(chord.id, -1)} style={{ paddingHorizontal: 0, minWidth: theme.s(34) }} />
          <Button label="" icon="close" tone="ghost" accessibilityLabel={`Remove ${entry.symbol}`}
            onPress={() => sequenceActions.removeChord(chord.id)} style={{ paddingHorizontal: 0, minWidth: theme.s(34) }} />
          <Button label="" icon="forward" tone="ghost" accessibilityLabel={`Move ${entry.symbol} later`} disabled={last}
            onPress={() => sequenceActions.move(chord.id, 1)} style={{ paddingHorizontal: 0, minWidth: theme.s(34) }} />
        </Row>
      ) : null}
    </View>
  );
}

function Arrow() {
  const theme = useTheme();
  return <Body size={14} color={theme.chrome.dim} accessible={false} style={{ alignSelf: 'center', paddingTop: theme.s(14) }}>→</Body>;
}

/**
 * The open sequence, pinned to the bottom of the chord book: its chords in
 * order with small diagrams, tap one to hear it. From here the sequence is
 * renamed, switched or shown large to play from.
 */
export function SequenceStrip({ setup, options, bottomInset }: Readonly<{ setup: ChordSetup; options: DiagramOptions; bottomInset: number }>) {
  const theme = useTheme();
  const router = useRouter();
  const sequence = useOpenSequence();
  const [editing, setEditing] = useState(false);
  const chords = sequence?.chords ?? [];
  const current = { instrument: setup.instrument, strings: setup.strings, tuningId: setup.tuning.id, capo: setup.capo };
  const elsewhere = sequence !== null && chords.length > 0 && !sameSetup(sequence.madeFor, current);
  const switchBack = () => {
    if (!sequence) return;
    const { instrument, strings, tuningId, capo } = sequence.madeFor;
    settingsActions.setSetup(instrument, strings, tuningId, capo);
  };

  return (
    <View style={{
      backgroundColor: theme.chrome.surface, borderTopWidth: theme.rule(1), borderTopColor: theme.chrome.lineSoft,
      paddingTop: theme.s(8), paddingBottom: bottomInset + theme.s(8), gap: theme.s(4),
    }}>
      <Row gap={6} style={{ paddingHorizontal: theme.s(12) }}>
        <Pressable onPress={() => router.push('/sequences')} accessibilityRole="button"
          accessibilityLabel={`Sequence: ${sequence?.name ?? 'none yet'}. Change, rename or start another`}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: theme.tap, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Label size={10}>Sequence</Label>
          <Row gap={6}>
            <Title size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{sequence?.name ?? 'None yet'}</Title>
            <Icon name="forward" size={12} color={theme.chrome.accent} />
          </Row>
        </Pressable>
        {chords.length > 0 ? (
          <>
            <Button label={editing ? 'Done' : 'Edit'} tone="ghost" onPress={() => setEditing((value) => !value)} />
            <Button label="Play" tone="accent" accessibilityLabel={`Play through ${sequence?.name ?? 'the sequence'}`}
              onPress={() => router.push({ pathname: '/sequence', params: { play: '1' } })} />
            <Button label="Show all" onPress={() => router.push('/sequence')} />
          </>
        ) : null}
      </Row>
      {elsewhere ? (
        <Row gap={8} style={{ paddingHorizontal: theme.s(12) }}>
          <Body size={13} color={theme.chrome.dim} style={{ flex: 1 }} numberOfLines={2}>Made for {madeForName(sequence)}</Body>
          <Button label="Switch" tone="ghost" accessibilityLabel={`Switch to ${madeForName(sequence)}`} onPress={switchBack} />
        </Row>
      ) : null}
      {chords.length === 0 ? (
        <Body size={14} color={theme.chrome.dim} style={{ paddingHorizontal: theme.s(12), paddingBottom: theme.s(6) }}>
          Tap + on a chord to add it here, in the order the song plays them.
        </Body>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.s(8), gap: theme.s(2) }}
          accessibilityLabel={`${sequence?.name}: ${chords.map((chord) => chordName(chord, setup.tuning.spelling)).join(', ')}`}>
          {chords.map((chord, index) => (
            <Row key={chord.id} gap={2} style={{ alignItems: 'flex-start' }}>
              {index > 0 ? <Arrow /> : null}
              <StripChord chord={chord} setup={setup} options={options} editing={editing}
                first={index === 0} last={index === chords.length - 1} />
            </Row>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
