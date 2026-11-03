import { View } from 'react-native';

import { groupByFamily, TUNING_FAMILY_LABEL, type Tuning } from '@domain';
import { useTheme } from '@theme';

import { Body, Card, Icon, Label, Num, PressableRow, Row, Rule, Stack, Title } from '../ui';
import { tuningLetters } from './Setup';

function TuningRow({ tuning, selected, onPick }: Readonly<{ tuning: Tuning; selected: boolean; onPick: (id: string) => void }>) {
  const theme = useTheme();
  return (
    <PressableRow onPress={() => onPick(tuning.id)} selected={selected}
      accessibilityLabel={`${tuning.name}, ${tuningLetters(tuning)}. ${tuning.description}`}>
      <Row gap={12} padX={16} padY={12}>
        <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <Title size={16}>{tuning.name}</Title>
            <Num size={14} color={theme.chrome.accent}>{tuningLetters(tuning)}</Num>
          </Row>
          <Body size={13} color={theme.chrome.dim}>{tuning.description}</Body>
        </Stack>
        <View style={{ width: theme.s(20), alignItems: 'center' }}>
          {selected ? <Icon name="check" size={16} color={theme.chrome.accent} /> : null}
        </View>
      </Row>
    </PressableRow>
  );
}

/** Every tuning for the current setup, grouped by family. */
export function TuningList({ tunings, selectedId, onPick }: Readonly<{
  tunings: readonly Tuning[];
  selectedId: string;
  onPick: (id: string) => void;
}>) {
  const theme = useTheme();
  return (
    <Stack gap={18}>
      {groupByFamily(tunings).map((group) => (
        <Stack key={group.family} gap={6}>
          <Label size={12} accessibilityRole="header" style={{ paddingHorizontal: theme.s(16) }}>{TUNING_FAMILY_LABEL[group.family]}</Label>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {group.tunings.map((tuning, index) => (
              <View key={tuning.id}>
                {index === 0 ? null : <Rule style={{ marginLeft: theme.s(16) }} />}
                <TuningRow tuning={tuning} selected={tuning.id === selectedId} onPick={onPick} />
              </View>
            ))}
          </Card>
        </Stack>
      ))}
    </Stack>
  );
}
