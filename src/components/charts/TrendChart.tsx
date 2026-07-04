import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Body } from '@/components/typography';
import { formatAvg } from '@/domain/stats';
import { fonts, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface TrendPoint {
  /** 1-based game number. */
  game: number;
  avg: number | null;
  ops: number | null;
}

const HEIGHT = 190;
const PAD = { top: 14, right: 44, bottom: 26, left: 40 };

/**
 * Cumulative AVG + OPS across the season, one point per game.
 * Two series → legend above + direct labels at the line ends;
 * text wears text tokens, the colored mark carries identity.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const avgSeries = points.filter((p): p is TrendPoint & { avg: number } => p.avg !== null);
  const opsSeries = points.filter((p): p is TrendPoint & { ops: number } => p.ops !== null);

  const allValues = [...avgSeries.map((p) => p.avg), ...opsSeries.map((p) => p.ops)];
  if (allValues.length === 0) return null;

  const yMax = Math.max(1, Math.ceil(Math.max(...allValues) * 4) / 4);
  const xMax = Math.max(...points.map((p) => p.game));
  const xMin = 1;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (game: number) =>
    PAD.left + (xMax === xMin ? plotW / 2 : ((game - xMin) / (xMax - xMin)) * plotW);
  const y = (value: number) => PAD.top + (1 - value / yMax) * plotH;

  const yTicks = [0, yMax / 2, yMax];
  const xTicks = xMax >= 3 ? [xMin, Math.round((xMin + xMax) / 2), xMax] : [xMin, xMax];

  const toPoints = (series: { game: number }[], value: (p: never) => number) =>
    series.map((p) => `${x(p.game)},${y(value(p as never))}`).join(' ');

  // Direct labels at line ends; nudge apart when the endpoints collide.
  const avgEnd = avgSeries[avgSeries.length - 1];
  const opsEnd = opsSeries[opsSeries.length - 1];
  let avgLabelY = avgEnd ? y(avgEnd.avg) : 0;
  let opsLabelY = opsEnd ? y(opsEnd.ops) : 0;
  if (avgEnd && opsEnd && Math.abs(avgLabelY - opsLabelY) < 14) {
    if (avgLabelY <= opsLabelY) {
      avgLabelY -= (14 - Math.abs(avgLabelY - opsLabelY)) / 2;
      opsLabelY += (14 - Math.abs(avgLabelY - opsLabelY)) / 2;
    } else {
      avgLabelY += 7;
      opsLabelY -= 7;
    }
  }

  return (
    <View style={{ gap: spacing.s }}>
      <View style={{ flexDirection: 'row', gap: spacing.l }}>
        <LegendItem color={colors.chart.avg} label="AVG" />
        <LegendItem color={colors.chart.ops} label="OPS" />
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {/* recessive grid: hairlines at the y ticks only */}
            {yTicks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={PAD.left}
                y1={y(tick)}
                x2={width - PAD.right}
                y2={y(tick)}
                stroke={colors.line}
                strokeWidth={1}
              />
            ))}
            {yTicks.map((tick) => (
              <SvgText
                key={`ylab-${tick}`}
                x={PAD.left - 6}
                y={y(tick) + 3.5}
                fontSize={10}
                fontFamily={fonts.mono}
                fill={colors.textSoft}
                textAnchor="end"
              >
                {tick === 0 ? '0' : formatAvg(tick)}
              </SvgText>
            ))}
            {xTicks.map((tick) => (
              <SvgText
                key={`xlab-${tick}`}
                x={x(tick)}
                y={HEIGHT - 8}
                fontSize={10}
                fontFamily={fonts.mono}
                fill={colors.textSoft}
                textAnchor="middle"
              >
                {`G${tick}`}
              </SvgText>
            ))}

            {opsSeries.length > 1 && (
              <Polyline
                points={toPoints(opsSeries, (p: { ops: number }) => p.ops)}
                fill="none"
                stroke={colors.chart.ops}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {avgSeries.length > 1 && (
              <Polyline
                points={toPoints(avgSeries, (p: { avg: number }) => p.avg)}
                fill="none"
                stroke={colors.chart.avg}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* end markers: 8px with a 2px surface ring */}
            {opsEnd && (
              <Circle
                cx={x(opsEnd.game)}
                cy={y(opsEnd.ops)}
                r={4}
                fill={colors.chart.ops}
                stroke={colors.bg}
                strokeWidth={2}
              />
            )}
            {avgEnd && (
              <Circle
                cx={x(avgEnd.game)}
                cy={y(avgEnd.avg)}
                r={4}
                fill={colors.chart.avg}
                stroke={colors.bg}
                strokeWidth={2}
              />
            )}

            {opsEnd && (
              <SvgText
                x={x(opsEnd.game) + 8}
                y={opsLabelY + 3.5}
                fontSize={10}
                fontFamily={fonts.monoSemiBold}
                fill={colors.text}
              >
                OPS
              </SvgText>
            )}
            {avgEnd && (
              <SvgText
                x={x(avgEnd.game) + 8}
                y={avgLabelY + 3.5}
                fontSize={10}
                fontFamily={fonts.monoSemiBold}
                fill={colors.text}
              >
                AVG
              </SvgText>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Body size={12} color={colors.textSoft}>
        {label}
      </Body>
    </View>
  );
}
