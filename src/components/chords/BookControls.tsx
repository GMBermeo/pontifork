import { useState } from 'react';
import { View } from 'react-native';

import {
  CHORD_TYPE_ORDER, CHORD_TYPES, keyName, keyTonicSpelling, MAX_CAPO, parseKeyId, spellingName, takesCapo,
  type BookTab, type ChordSetup, type DotLabels, type KeyMode,
} from '@domain';
import {
  bookActions, useAllPositions, useBookKey, useBookTab, useCapo, useChordSound, useDotLabels, useLeftHanded,
} from '@state';
import { useTheme } from '@theme';

import { InstrumentPicker, TuningCard } from '../tuner/Setup';
import {
  Body, Card, ChipGroup, Icon, Label, PressableRow, Row, Segmented, Stack, Stepper, Toggle, type Segment,
} from '../ui';

const ALL_KEYS = 'all';

const MODES: readonly Segment<KeyMode>[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
];

const LABELS: readonly Segment<DotLabels>[] = [
  { value: 'fingers', label: 'Fingers' },
  { value: 'notes', label: 'Notes' },
];

/** The key filter: all keys, or a tonic and a mode. */
function KeyPicker({ setup }: Readonly<{ setup: ChordSetup }>) {
  const key = parseKeyId(useBookKey());
  const tie = setup.tuning.spelling;
  const mode = key?.mode ?? 'major';
  const tonics: Segment<string>[] = [
    { value: ALL_KEYS, label: 'All keys' },
    ...Array.from({ length: 12 }, (_, tonic) => ({
      value: String(tonic),
      label: `${spellingName(keyTonicSpelling(tonic, mode, tie))}${mode === 'minor' ? 'm' : ''}`,
    })),
  ];
  return (
    <Stack gap={8}>
      <Label size={11}>Key</Label>
      <ChipGroup segments={tonics} value={key ? String(key.tonic) : ALL_KEYS} accessibilityLabel="Key"
        onChange={(value) => bookActions.setKey(value === ALL_KEYS ? null : { tonic: Number(value), mode })} />
      {key ? (
        <Segmented segments={MODES} value={key.mode} accessibilityLabel="Major or minor key"
          onChange={(next) => bookActions.setKey({ tonic: key.tonic, mode: next })} />
      ) : null}
    </Stack>
  );
}

/** The type switch, with the key's own page first while a key is chosen. */
function TypeTabs({ setup }: Readonly<{ setup: ChordSetup }>) {
  const tab = useBookTab();
  const key = parseKeyId(useBookKey());
  const tabs: Segment<BookTab>[] = [
    ...(key ? [{ value: 'key' as const, label: `In ${keyName(key, setup.tuning.spelling)}` }] : []),
    ...CHORD_TYPE_ORDER.map((id) => ({ value: id, label: CHORD_TYPES[id].name })),
  ];
  return (
    <Stack gap={8}>
      <Label size={11}>Chords</Label>
      <ChipGroup segments={tabs} value={tab} onChange={bookActions.setTab} accessibilityLabel="Chord type" />
    </Stack>
  );
}

function displaySummary(labels: DotLabels, capo: number, allPositions: boolean, leftHanded: boolean): string {
  const parts = [labels === 'fingers' ? 'Fingers' : 'Notes'];
  if (capo > 0) parts.push(`Capo ${capo}`);
  if (allPositions) parts.push('All positions');
  if (leftHanded) parts.push('Left-handed');
  return parts.join(' · ');
}

/** How diagrams are drawn, folded away until wanted. */
function DisplayOptions({ setup }: Readonly<{ setup: ChordSetup }>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const labels = useDotLabels();
  const allPositions = useAllPositions();
  const leftHanded = useLeftHanded();
  const sound = useChordSound();
  const capo = useCapo();
  const capoApplies = takesCapo(setup.instrument);
  const summary = displaySummary(labels, capoApplies ? capo : 0, allPositions, leftHanded);
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <PressableRow onPress={() => setOpen((value) => !value)} accessibilityLabel={`Display: ${summary}. ${open ? 'Hide' : 'Show'} options`}>
        <Row gap={12} pad={16}>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Label size={11}>Display</Label>
            <Body size={15} numberOfLines={1}>{summary}</Body>
          </Stack>
          <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
            <Icon name="forward" size={15} color={theme.chrome.accent} />
          </View>
        </Row>
      </PressableRow>
      {open ? (
        <Stack gap={10} style={{ paddingHorizontal: theme.s(16), paddingBottom: theme.s(16) }}>
          <Segmented segments={LABELS} value={labels} onChange={bookActions.setLabels} accessibilityLabel="Dots show" />
          <Toggle label="All positions" hint="Mark every place the chord's notes fall, up to the twelfth fret."
            value={allPositions} onChange={bookActions.setAllPositions} />
          <Toggle label="Left-handed" hint="Mirror the diagrams: low string on the right."
            value={leftHanded} onChange={bookActions.setLeftHanded} />
          <Toggle label="Play chords when tapped" value={sound} onChange={bookActions.setSound} />
          {capoApplies ? (
            <Row gap={12} style={{ minHeight: theme.tap }}>
              <View style={{ flex: 1, minWidth: 0, gap: theme.s(2) }}>
                <Body size={15}>Capo</Body>
                <Body size={13} color={theme.chrome.dim}>Frets are counted from the capo.</Body>
              </View>
              <Stepper label="Capo" display={capo === 0 ? 'None' : `Fret ${capo}`}
                onDecrement={() => bookActions.setCapo(capo - 1)} onIncrement={() => bookActions.setCapo(capo + 1)}
                canDecrement={capo > 0} canIncrement={capo < MAX_CAPO} />
            </Row>
          ) : null}
        </Stack>
      ) : null}
    </Card>
  );
}

/** Everything above the grid: what is being played, which chords, and how they are drawn. */
export function BookControls({ setup }: Readonly<{ setup: ChordSetup }>) {
  const theme = useTheme();
  const wide = !theme.scale.compact;
  return (
    <Stack gap={14}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.s(14) }}>
        <View style={{ flex: wide ? 1 : undefined, gap: theme.s(14) }}>
          <InstrumentPicker />
          <TuningCard />
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <DisplayOptions setup={setup} />
        </View>
      </View>
      <KeyPicker setup={setup} />
      <TypeTabs setup={setup} />
    </Stack>
  );
}
