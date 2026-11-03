import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';
import { Platform, Text } from 'react-native';

import { FACE, useTheme } from '@theme';

export type IconName = 'forward' | 'back' | 'close' | 'plus' | 'minus' | 'check' | 'tuner' | 'mic' | 'play' | 'stop';

type SFSymbol = Extract<SymbolViewProps['name'], string>;
interface Glyph { sf: SFSymbol; text: string }

/**
 * One name per meaning, drawn as an SF Symbol on iOS and as a plain glyph
 * elsewhere. Screens ask for `close`, not `xmark`, so the whole app changes
 * symbol in one place.
 */
const GLYPHS: Record<IconName, Glyph> = {
  forward: { sf: 'chevron.right', text: '›' },
  back: { sf: 'chevron.left', text: '‹' },
  close: { sf: 'xmark', text: '×' },
  plus: { sf: 'plus', text: '+' },
  minus: { sf: 'minus', text: '−' },
  check: { sf: 'checkmark', text: '✓' },
  tuner: { sf: 'tuningfork', text: '♮' },
  mic: { sf: 'mic.fill', text: '●' },
  play: { sf: 'play.fill', text: '▶' },
  stop: { sf: 'stop.fill', text: '■' },
};

export interface IconProps {
  name: IconName;
  /** Design units. */
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}

export function Icon({ name, size = 17, color, weight = 'semibold' }: Readonly<IconProps>) {
  const theme = useTheme();
  const glyph = GLYPHS[name];
  const tint = color ?? theme.chrome.ink;
  const px = theme.s(size);
  const fallback = (
    <Text
      accessible={false}
      style={{ ...FACE.semibold, fontSize: px, lineHeight: px * 1.15, color: tint, textAlign: 'center', minWidth: px }}
    >
      {glyph.text}
    </Text>
  );
  if (Platform.OS !== 'ios') return fallback;
  return (
    <SymbolView
      name={glyph.sf}
      size={px}
      tintColor={tint}
      weight={weight}
      fallback={fallback}
      accessible={false}
      style={{ width: px, height: px }}
    />
  );
}
