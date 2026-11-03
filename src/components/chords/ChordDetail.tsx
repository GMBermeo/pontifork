import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import {
  chordToneSpellings, CHORD_TYPES, shapesFor, spellingName,
  type BookEntry, type ChordSetup, type DiagramOptions,
} from '@domain';
import { RADIUS, useTheme } from '@theme';

import { Body, Button, Label, Row, Stack, Title, useControlFeedback } from '../ui';
import { ChordDiagram } from './ChordDiagram';
import { diagramOf, noShape, shapeDescription, usePlayShape } from './useBook';

/** Which shape is showing, what it is called, and the way to the others. */
function ShapeStepper({ label, index, count, onStep }: Readonly<{ label: string | null; index: number; count: number; onStep: (next: number) => void }>) {
  const theme = useTheme();
  if (count === 0) {
    return (
      <Body size={14} color={theme.chrome.dim}>
        No shape within the hand&apos;s reach in this tuning. Every place its notes fall is marked: play it note by note.
      </Body>
    );
  }
  return (
    <Stack gap={8}>
      <Label size={11}>{count > 1 ? `Shape ${index + 1} of ${count}` : 'Shape'}</Label>
      {label === null ? null : <Body size={15}>{label}</Body>}
      {count > 1 ? (
        <Row gap={8}>
          <Button label="Previous" disabled={index === 0} onPress={() => onStep(index - 1)} />
          <Button label="Next shape" disabled={index >= count - 1} onPress={() => onStep(index + 1)} />
        </Row>
      ) : null}
    </Stack>
  );
}

export interface ChordDetailProps {
  entry: BookEntry;
  setup: ChordSetup;
  options: DiagramOptions;
  shape: number;
  onShape: (shape: number) => void;
  onAdd: (shape: number) => void;
  onClose: () => void;
}

/**
 * A chord opened from the grid: one shape at a time, large, with the others a
 * step away, what it is made of, and a way to hear it or add it to the
 * sequence. Opens in place, under the chord's row.
 */
export function ChordDetail({ entry, setup, options, shape, onShape, onAdd, onClose }: Readonly<ChordDetailProps>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const play = usePlayShape();
  const shapes = useMemo(() => shapesFor(setup, entry), [setup, entry]);
  const index = Math.min(shape, Math.max(0, shapes.length - 1));
  const current = shapes[index];
  const model = useMemo(
    () => diagramOf(entry, current ?? noShape(setup.strings), setup, { ...options, allPositions: options.allPositions || !current }),
    [entry, current, setup, options],
  );
  const tones = chordToneSpellings(entry.spelling, entry.type, setup.tuning.spelling).map(spellingName);
  const intervals = CHORD_TYPES[entry.type].intervals.map((interval) => interval.label);
  const compact = theme.scale.compact;
  // On a phone the name leads, above the diagram; beside it, it heads the column.
  const header = (
    <Row gap={10} style={{ alignItems: 'baseline' }}>
      <Title size={30} accessibilityRole="header" style={{ flexShrink: 1 }}>{entry.symbol}</Title>
      {entry.degree === null ? null : <Title size={20} color={theme.chrome.dim}>{entry.degree}</Title>}
      <View style={{ flex: 1 }} />
      <Button label="Close" tone="ghost" onPress={onClose} />
    </Row>
  );
  const step = (next: number) => {
    onShape(next);
    play(shapes[next]);
  };

  return (
    <View style={{
      backgroundColor: theme.chrome.surface, ...theme.corners(RADIUS.lg), padding: theme.s(16),
      borderWidth: theme.rule(2), borderColor: theme.chrome.accent,
      flexDirection: compact ? 'column' : 'row', gap: theme.s(compact ? 10 : 18), alignItems: compact ? 'stretch' : 'flex-start',
    }}>
      {compact ? header : null}
      <Pressable {...feedback.events} onPress={() => play(current)} disabled={!current}
        accessibilityRole="button" accessibilityLabel={current ? `${shapeDescription(entry, current)}. Play` : `${entry.symbol}: every place its notes fall`}
        style={({ pressed }) => [{ alignItems: 'center', ...theme.corners(RADIUS.md), opacity: pressed ? 0.7 : 1 }, feedback.focusStyle]}>
        <ChordDiagram model={model} width={Math.min(230, (300 * model.width) / model.height)} accessibilityLabel={current ? shapeDescription(entry, current) : entry.symbol} />
      </Pressable>
      <Stack gap={12} style={{ flex: compact ? undefined : 1, minWidth: 0 }}>
        {compact ? null : header}
        <Stack gap={4}>
          <Label size={11}>Notes</Label>
          <Body size={17}>{tones.join(' · ')}</Body>
          <Body size={13} color={theme.chrome.dim}>{intervals.join(' · ')}</Body>
        </Stack>
        <ShapeStepper label={current?.label ?? null} index={index} count={shapes.length} onStep={step} />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Button label="Play" disabled={!current} onPress={() => play(current)} />
          <Button label="Add to sequence" icon="plus" tone="accent" disabled={!current} onPress={() => onAdd(index)} />
        </Row>
      </Stack>
    </View>
  );
}
