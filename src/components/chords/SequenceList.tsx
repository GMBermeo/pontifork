import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { chordName, findTuning } from '@domain';
import { MAX_NAME_LENGTH, sequenceActions, useOpenSequence, useSequences, type ChordSequence } from '@state';
import { FACE, RADIUS, useTheme } from '@theme';

import { Body, Button, Card, Icon, PressableRow, Row, Stack, Title } from '../ui';
import { madeForName } from './SequenceStrip';

function chordsLine(sequence: ChordSequence): string {
  if (sequence.chords.length === 0) return 'No chords yet';
  const { instrument, strings, tuningId } = sequence.madeFor;
  const tie = findTuning(instrument, strings, tuningId).spelling;
  return sequence.chords.map((chord) => chordName(chord, tie)).join(' → ');
}

interface RowProps {
  sequence: ChordSequence;
  open: boolean;
  onOpen: () => void;
}

/** One saved sequence: open it, rename it, or delete it (asked twice, inline). */
function SequenceRow({ sequence, open, onOpen }: Readonly<RowProps>) {
  const theme = useTheme();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(sequence.name);
  const [confirming, setConfirming] = useState(false);
  const saveName = () => {
    sequenceActions.rename(sequence.id, name);
    setRenaming(false);
  };
  return (
    <Card pad={0} style={{ overflow: 'hidden', borderWidth: theme.rule(2), borderColor: open ? theme.chrome.accent : 'transparent' }}>
      {renaming ? (
        <Row gap={8} pad={12}>
          <TextInput value={name} onChangeText={setName} onSubmitEditing={saveName} autoFocus maxLength={MAX_NAME_LENGTH}
            accessibilityLabel="Sequence name" returnKeyType="done" selectTextOnFocus
            style={{
              flex: 1, minHeight: theme.tap, paddingHorizontal: theme.s(16), ...theme.corners(RADIUS.pill),
              backgroundColor: theme.chrome.fill, color: theme.chrome.ink, ...FACE.regular, fontSize: theme.font(16),
            }} />
          <Button label="Save" tone="accent" onPress={saveName} />
        </Row>
      ) : (
        <PressableRow onPress={onOpen} selected={false} accessibilityLabel={`${sequence.name}: ${chordsLine(sequence)}. ${open ? 'Open now' : 'Open'}`}>
          <Row gap={12} pad={16}>
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Title size={18} numberOfLines={1}>{sequence.name}</Title>
              <Body size={15} numberOfLines={2}>{chordsLine(sequence)}</Body>
              <Body size={13} color={theme.chrome.dim} numberOfLines={1}>{madeForName(sequence)}</Body>
            </Stack>
            {open ? <Icon name="check" color={theme.chrome.accent} /> : null}
          </Row>
        </PressableRow>
      )}
      {renaming ? null : (
        <Row gap={4} style={{ paddingHorizontal: theme.s(8), paddingBottom: theme.s(8), justifyContent: 'flex-end' }}>
          {confirming ? (
            <>
              <Body size={14} color={theme.chrome.far} style={{ flex: 1, paddingLeft: theme.s(8) }}>Delete for good?</Body>
              <Button label="Keep" tone="ghost" onPress={() => setConfirming(false)} />
              <Button label="Delete" tone="ghost" accessibilityLabel={`Delete ${sequence.name} for good`} onPress={() => sequenceActions.remove(sequence.id)} />
            </>
          ) : (
            <>
              <Button label="Rename" tone="ghost" onPress={() => { setName(sequence.name); setRenaming(true); }} />
              <Button label="Delete" tone="ghost" accessibilityLabel={`Delete ${sequence.name}`} onPress={() => setConfirming(true)} />
            </>
          )}
        </Row>
      )}
    </Card>
  );
}

/** Every saved sequence, and a new one. Choosing one opens it in the book's strip. */
export function SequenceList({ onDone }: Readonly<{ onDone: () => void }>) {
  const theme = useTheme();
  const sequences = useSequences();
  const open = useOpenSequence();
  return (
    <Stack gap={12}>
      <Row>
        <Button label="New sequence" icon="plus" tone="accent" onPress={() => { sequenceActions.create(); onDone(); }} />
      </Row>
      {sequences.length === 0 ? (
        <Body color={theme.chrome.dim}>No sequences yet. Tap + on any chord in the book to start one.</Body>
      ) : null}
      {sequences.map((sequence) => (
        <View key={sequence.id}>
          <SequenceRow sequence={sequence} open={sequence.id === open?.id}
            onOpen={() => { sequenceActions.select(sequence.id); onDone(); }} />
        </View>
      ))}
    </Stack>
  );
}
