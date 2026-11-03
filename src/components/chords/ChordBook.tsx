import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { bookPage, chordKey, parseKeyId, setupName, shapesFor, type BookEntry } from '@domain';
import { sequenceActions, useBookKey, useBookTab } from '@state';
import { useTheme } from '@theme';

import { tuningLetters } from '../tuner/Setup';
import { Body, Button, ScreenHeader } from '../ui';
import { BookControls } from './BookControls';
import { ChordDetail } from './ChordDetail';
import { ChordTile } from './ChordTile';
import { SequenceStrip } from './SequenceStrip';
import { useChordSetup, useDiagramOptions, usePlayShape, useTabBarInset } from './useBook';

/** Narrowest a tile is drawn, in design units: room for a seven-string diagram. */
const MIN_TILE = 176;
const MAX_COLUMNS = 6;
const GUTTER = 12;
const GAP = 10;

type GridRow =
  | { kind: 'tiles'; key: string; entries: BookEntry[] }
  | { kind: 'detail'; key: string; entry: BookEntry };

/** The page as rows of tiles, with the opened chord's detail under its own row. */
function gridRows(entries: readonly BookEntry[], columns: number, openKey: string | null): GridRow[] {
  const rows: GridRow[] = [];
  for (let start = 0; start < entries.length; start += columns) {
    const slice = entries.slice(start, start + columns);
    rows.push({ kind: 'tiles', key: slice.map(chordKey).join('|'), entries: slice });
    const opened = slice.find((entry) => chordKey(entry) === openKey);
    if (opened) rows.push({ kind: 'detail', key: `detail-${openKey}`, entry: opened });
  }
  return rows;
}

/**
 * The chord book: the setup and filters, a grid of chords for the chosen
 * type or key, and the open sequence pinned underneath.
 */
export function ChordBook() {
  const theme = useTheme();
  const router = useRouter();
  const setup = useChordSetup();
  const options = useDiagramOptions(setup);
  const tab = useBookTab();
  const keyIdValue = useBookKey();
  const play = usePlayShape();
  const bottomInset = useTabBarInset();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [shape, setShape] = useState(0);

  const key = useMemo(() => parseKeyId(keyIdValue), [keyIdValue]);
  const entries = useMemo(() => bookPage(tab, key, setup.tuning.spelling), [tab, key, setup.tuning.spelling]);
  const content = theme.scale.width - GUTTER * 2;
  const columns = Math.max(2, Math.min(MAX_COLUMNS, Math.floor((content + GAP) / (MIN_TILE + GAP))));
  const tileWidth = (content - GAP * (columns - 1)) / columns - 12;
  const rows = useMemo(() => gridRows(entries, columns, openKey), [entries, columns, openKey]);
  const keyActive = key !== null && tab !== 'key';

  const select = (entry: BookEntry) => {
    const next = chordKey(entry);
    setShape(0);
    setOpenKey((current) => (current === next ? null : next));
    play(shapesFor(setup, entry)[0]);
  };
  const add = (entry: BookEntry, index: number) => sequenceActions.add(entry.root, entry.type, index);

  const capo = setup.capo > 0 ? ` · Capo ${setup.capo}` : '';
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Chords" subtitle={`${setupName(setup.instrument, setup.strings)} · ${setup.tuning.name}${capo}`}>
        <Button label="Tuning" tone="ghost" accessibilityLabel={`Tuning: ${setup.tuning.name}, ${tuningLetters(setup.tuning)}. Change tuning`}
          onPress={() => router.push('/tunings')} />
      </ScreenHeader>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={4}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: theme.s(GUTTER), paddingBottom: theme.s(24), gap: theme.s(GAP) }}
        ListHeaderComponent={<View style={{ paddingBottom: theme.s(6), paddingHorizontal: theme.s(4) }}><BookControls setup={setup} /></View>}
        ListEmptyComponent={<Body color={theme.chrome.dim}>No chords on this page.</Body>}
        renderItem={({ item }) => {
          if (item.kind === 'detail') {
            return (
              <ChordDetail entry={item.entry} setup={setup} options={options} shape={shape} onShape={setShape}
                onAdd={(index) => add(item.entry, index)} onClose={() => setOpenKey(null)} />
            );
          }
          return (
            <View style={{ flexDirection: 'row', gap: theme.s(GAP) }}>
              {item.entries.map((entry) => (
                <ChordTile key={chordKey(entry)} entry={entry} setup={setup} options={options} width={tileWidth}
                  selected={chordKey(entry) === openKey} muted={keyActive && entry.degree === null}
                  onSelect={select} onAdd={add} />
              ))}
              {Array.from({ length: columns - item.entries.length }, (_, index) => <View key={`gap${index}`} style={{ flex: 1 }} />)}
            </View>
          );
        }}
      />
      <SequenceStrip setup={setup} options={options} bottomInset={bottomInset} />
    </View>
  );
}
