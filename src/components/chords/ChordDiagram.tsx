import { memo } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { DIAGRAM, type DiagramMarker, type DiagramModel } from '@domain';
import { alpha, useTheme, type Chrome } from '@theme';

/** SVG text takes a family name; iOS draws its system face when given none. */
const SVG_FONT: { fontFamily?: string } = Platform.OS === 'ios' ? {} : { fontFamily: 'Archivo_600SemiBold' };
/** The dashed line marking where an "All positions" board starts. */
const POSITION_DASH = { strokeDasharray: '2 4' } as const;

/**
 * A stop in the shape is filled (the root in the accent); a note elsewhere on
 * the neck is an outline, a little smaller, so the shape reads first.
 */
function markerPaint(marker: DiagramMarker, chrome: Chrome): { fill: string; stroke: string; text: string; size: number } {
  const tone = marker.root ? chrome.accent : chrome.ink;
  if (marker.role === 'related') {
    return { fill: chrome.surface, stroke: alpha(marker.root ? chrome.accent : chrome.dim, 0.9), text: chrome.dim, size: DIAGRAM.dot - 1.5 };
  }
  return { fill: tone, stroke: 'none', text: marker.root ? chrome.onAccent : chrome.surface, size: DIAGRAM.dot };
}

export interface ChordDiagramProps {
  model: DiagramModel;
  /** Design units. */
  width: number;
  accessibilityLabel: string;
  /** Faded, for a chord outside the selected key. */
  muted?: boolean;
}

/**
 * Draws a diagram model: the board, a filled dot (or, for the root, a square)
 * for every stop with its finger or note, the barres behind them, open and
 * unplayed strings above the nut and the sounding notes below. Notes elsewhere
 * on the neck ("All positions") are outlined, so the shape still reads first.
 */
export const ChordDiagram = memo(function ChordDiagram({ model, width, accessibilityLabel, muted = false }: ChordDiagramProps) {
  const theme = useTheme();
  const { chrome } = theme;
  const px = theme.s(width);
  const ink = chrome.ink;
  const dot = DIAGRAM.dot;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ opacity: muted ? 0.45 : 1 }}>
      <Svg width={px} height={(px * model.height) / model.width} viewBox={`0 0 ${model.width} ${model.height}`}>
        {model.lines.map((line) => {
          let stroke = chrome.line;
          let strokeWidth = 1.2;
          if (line.kind === 'nut') { stroke = ink; strokeWidth = 5; }
          if (line.kind === 'capo') { stroke = chrome.accent; strokeWidth = 6; }
          return (
            <Line key={`l${line.y}`} x1={line.left - (line.kind === 'fret' || line.kind === 'position' ? 0 : 2)} x2={line.right + (line.kind === 'fret' || line.kind === 'position' ? 0 : 2)}
              y1={line.y} y2={line.y} stroke={stroke} strokeWidth={strokeWidth}
              {...(line.kind === 'position' ? POSITION_DASH : {})} strokeLinecap="round" />
          );
        })}
        {model.strings.map((string) => (
          <Line key={`s${string.x}`} x1={string.x} x2={string.x} y1={string.top} y2={string.bottom} stroke={chrome.dim} strokeWidth={1.3} />
        ))}
        {model.startLabel ? (
          <SvgText x={model.startLabel.x} y={model.startLabel.y + 4} fontSize={11} {...SVG_FONT} fontWeight="600"
            fill={chrome.dim} textAnchor="end">{model.startLabel.text}</SvgText>
        ) : null}
        {/* A barre: one finger lying across the strings, drawn as a band behind its dots. */}
        {model.barres.map((barre) => (
          <Rect key={`b${barre.y}-${barre.left}`} x={barre.left} y={barre.y - dot * 0.55} width={barre.right - barre.left} height={dot * 1.1}
            fill={ink} fillOpacity={0.55} />
        ))}
        {model.markers.map((marker) => {
          const { fill, stroke, text: textColor, size } = markerPaint(marker, chrome);
          return (
            <G key={`m${marker.x}-${marker.y}-${marker.role}`}>
              {marker.root ? (
                <Rect x={marker.x - size} y={marker.y - size} width={size * 2} height={size * 2} rx={2.5}
                  fill={fill} stroke={stroke} strokeWidth={1.5} />
              ) : (
                <Circle cx={marker.x} cy={marker.y} r={size} fill={fill} stroke={stroke} strokeWidth={1.5} />
              )}
              {marker.text ? (
                <SvgText x={marker.x} y={marker.y + (marker.text.length > 1 ? 3.2 : 4)} fontSize={marker.text.length > 1 ? 8.5 : 11}
                  {...SVG_FONT} fontWeight="700" fill={textColor} textAnchor="middle">{marker.text}</SvgText>
              ) : null}
            </G>
          );
        })}
        {model.tops.map((top) => {
          if (top.kind === 'muted') {
            return (
              <SvgText key={`t${top.x}`} x={top.x} y={top.y + 4.5} fontSize={13} {...SVG_FONT} fontWeight="600"
                fill={chrome.dim} textAnchor="middle">×</SvgText>
            );
          }
          return top.root ? (
            <Rect key={`t${top.x}`} x={top.x - 5} y={top.y - 5} width={10} height={10} rx={1.5} fill="none" stroke={chrome.accent} strokeWidth={1.8} />
          ) : (
            <Circle key={`t${top.x}`} cx={top.x} cy={top.y} r={5} fill="none" stroke={ink} strokeWidth={1.6} />
          );
        })}
        {model.names.map((name) => (
          <SvgText key={`n${name.x}`} x={name.x} y={name.y} fontSize={10} {...SVG_FONT} fontWeight="600"
            fill={chrome.dim} textAnchor="middle">{name.text}</SvgText>
        ))}
      </Svg>
    </View>
  );
});
