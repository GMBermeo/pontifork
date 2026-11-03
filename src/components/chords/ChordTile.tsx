import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { shapesFor, type BookEntry, type ChordSetup, type DiagramOptions } from '@domain';
import { RADIUS, useTheme } from '@theme';

import { Body, Button, Row, Title, useControlFeedback } from '../ui';
import { ChordDiagram } from './ChordDiagram';
import { diagramOf, noShape, shapeDescription } from './useBook';

/** The tallest a tile's diagram is drawn, in design units, whatever the string count. */
const MAX_DIAGRAM_HEIGHT = 190;
/** With every position marked the board runs to the twelfth fret: let it grow rather than shrink. */
const MAX_ALL_POSITIONS_HEIGHT = 420;

export interface ChordTileProps {
  entry: BookEntry;
  setup: ChordSetup;
  options: DiagramOptions;
  /** Design units available for the diagram. */
  width: number;
  selected: boolean;
  /** Outside the selected key: drawn faded. */
  muted: boolean;
  onSelect: (entry: BookEntry) => void;
  onAdd: (entry: BookEntry, shape: number) => void;
}

function shapeCount(count: number): string {
  if (count === 0) return 'No shape in reach';
  return count === 1 ? 'One shape' : `${count} shapes`;
}

/** Under the diagram: what the shape is called, how many more there are, or why there is none. */
function TileCaption({ label, more, hasShape, hasDiagram }: Readonly<{ label: string | null; more: number; hasShape: boolean; hasDiagram: boolean }>) {
  const theme = useTheme();
  if (hasShape) {
    return (
      <Body size={12} color={theme.chrome.dim} numberOfLines={1} style={{ minHeight: theme.font(12) * 1.4 }}>
        {label ?? (more > 0 ? `+${more} more` : ' ')}
      </Body>
    );
  }
  return (
    <Body size={13} color={theme.chrome.dim} style={{ paddingVertical: theme.s(hasDiagram ? 4 : 24), textAlign: 'center' }}>
      {hasDiagram ? 'No shape within reach: play it note by note.' : 'No shape within reach in this tuning. Turn on All positions to see where its notes are.'}
    </Body>
  );
}

/**
 * One chord in the grid: its name (and degree in the key), its first shape,
 * and a + that adds it to the open sequence. Tapping it opens its shapes.
 */
export function ChordTile({ entry, setup, options, width, selected, muted, onSelect, onAdd }: Readonly<ChordTileProps>) {
  const theme = useTheme();
  const feedback = useControlFeedback();
  const shapes = useMemo(() => shapesFor(setup, entry), [setup, entry]);
  const first = shapes[0];
  const model = useMemo(() => {
    if (first) return diagramOf(entry, first, setup, options);
    return options.allPositions ? diagramOf(entry, noShape(setup.strings), setup, options) : null;
  }, [entry, first, setup, options]);
  const tallest = options.allPositions ? MAX_ALL_POSITIONS_HEIGHT : MAX_DIAGRAM_HEIGHT;
  const diagramWidth = model ? Math.min(width, (tallest * model.width) / model.height) : width;
  const name = entry.degree === null ? entry.symbol : `${entry.symbol}, ${entry.degree}`;

  return (
    <View style={{
      flex: 1, backgroundColor: theme.chrome.surface, ...theme.corners(RADIUS.lg),
      borderWidth: theme.rule(2), borderColor: selected ? theme.chrome.accent : 'transparent', overflow: 'hidden',
    }}>
      <Row gap={6} style={{ paddingLeft: theme.s(14), paddingRight: theme.s(4), paddingTop: theme.s(6) }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: theme.s(8) }}>
          <Title size={22} numberOfLines={1} style={{ flexShrink: 1, opacity: muted ? 0.6 : 1 }}>{entry.symbol}</Title>
          {entry.degree === null ? null : <Title size={15} color={theme.chrome.dim}>{entry.degree}</Title>}
        </View>
        <Button label="" icon="plus" tone="ghost" accessibilityLabel={`Add ${name} to the sequence`}
          disabled={!first} onPress={() => onAdd(entry, 0)} style={{ paddingHorizontal: 0, minWidth: theme.tap }} />
      </Row>
      <Pressable {...feedback.events} onPress={() => onSelect(entry)}
        accessibilityRole="button" accessibilityState={{ expanded: selected }}
        accessibilityLabel={`${name}. ${shapeCount(shapes.length)}. Show and play`}
        style={({ pressed }) => [{
          alignItems: 'center', paddingBottom: theme.s(10), paddingHorizontal: theme.s(6),
          backgroundColor: feedback.hovered ? theme.chrome.fill : 'transparent', opacity: pressed ? 0.7 : 1,
        }, feedback.focusStyle]}>
        {model ? (
          <ChordDiagram model={model} width={diagramWidth} muted={muted}
            accessibilityLabel={first ? shapeDescription(entry, first) : `${entry.symbol}: every place its notes fall.`} />
        ) : null}
        <TileCaption label={first ? first.label : null} more={shapes.length - 1} hasShape={Boolean(first)} hasDiagram={model !== null} />
      </Pressable>
    </View>
  );
}
