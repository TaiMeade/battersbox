import { View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { Body } from '@/components/typography';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The field diagram — a chalk scorebook sketch on the app surface, so the
 * dots can use the CVD-validated chart palette (hits grass, outs clay,
 * sacrifice bunting blue) plus shape encoding: hits are filled dots, outs
 * are open rings, sacrifices are diamonds. Identity is never color-alone.
 *
 * Geometry lives in a 100×78 viewBox: home plate at (50,72), foul poles at
 * (8,30)/(92,30), fence arc radius 59.4 from home. Locations are stored
 * normalized: sprayX = x/100, sprayY = y/78 of the diagram rect.
 */
export const FIELD_ASPECT = 100 / 78;

/** Only batted balls land on the chart — on-base awards (BB/HBP) never do. */
export type SprayGroup = 'hit' | 'out' | 'sacrifice';

export interface SprayPoint {
  /** 0..1 across the diagram width. */
  x: number;
  /** 0..1 down the diagram height. */
  y: number;
  group: SprayGroup;
}

function diamond(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

function FieldPaths() {
  const { colors } = useTheme();
  const base = (cx: number, cy: number) => (
    <Polygon points={diamond(cx, cy, 1.3)} fill={colors.line} />
  );
  return (
    <>
      {/* fair territory: foul lines + fence arc */}
      <Path
        d="M 8 30 A 59.4 59.4 0 0 1 92 30 L 50 72 Z"
        fill={colors.chart.groups.hit}
        fillOpacity={0.08}
        stroke={colors.line}
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
      {/* infield dirt */}
      <Path
        d="M 33 55 A 24 24 0 0 1 67 55 L 50 72 Z"
        fill={colors.chart.groups.out}
        fillOpacity={0.14}
      />
      {/* basepaths */}
      <Path
        d="M 50 72 L 62 60 L 50 48 L 38 60 Z"
        fill="none"
        stroke={colors.line}
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
      {/* mound */}
      <Circle cx={50} cy={60.5} r={2} fill={colors.chart.groups.out} fillOpacity={0.25} />
      {base(62, 60)}
      {base(50, 48)}
      {base(38, 60)}
      {base(50, 71)}
    </>
  );
}

function Mark({ point }: { point: SprayPoint }) {
  const { colors } = useTheme();
  const color = colors.chart.groups[point.group];
  const cx = point.x * 100;
  const cy = point.y * 78;
  if (point.group === 'out') {
    return <Circle cx={cx} cy={cy} r={1.5} fill="none" stroke={color} strokeWidth={1} />;
  }
  if (point.group === 'sacrifice') {
    return (
      <Polygon points={diamond(cx, cy, 2.1)} fill={color} stroke={colors.bg} strokeWidth={0.55} />
    );
  }
  return <Circle cx={cx} cy={cy} r={1.7} fill={color} stroke={colors.bg} strokeWidth={0.55} />;
}

const Z_ORDER: Record<SprayGroup, number> = { out: 0, sacrifice: 1, hit: 2 };

export function SprayField({ points }: { points: SprayPoint[] }) {
  const sorted = [...points].sort((a, b) => Z_ORDER[a.group] - Z_ORDER[b.group]);
  return (
    <View style={{ width: '100%', aspectRatio: FIELD_ASPECT }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 78">
        <FieldPaths />
        {sorted.map((p, i) => (
          <Mark key={i} point={p} />
        ))}
      </Svg>
    </View>
  );
}

const LEGEND: { group: SprayGroup; label: string }[] = [
  { group: 'hit', label: 'Hits' },
  { group: 'out', label: 'Outs in play' },
  { group: 'sacrifice', label: 'Sacrifices' },
];

export function SprayLegend({ points }: { points: SprayPoint[] }) {
  const { colors } = useTheme();
  const counts: Record<SprayGroup, number> = { hit: 0, out: 0, sacrifice: 0 };
  for (const p of points) counts[p.group] += 1;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.l }}>
      {LEGEND.filter((item) => counts[item.group] > 0).map((item) => (
        <View
          key={item.group}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Svg width={14} height={14} viewBox="0 0 10 10">
            <Mark point={{ x: 0.05, y: 5 / 78, group: item.group }} />
          </Svg>
          <Body size={13} color={colors.textSoft}>
            {item.label} · {counts[item.group]}
          </Body>
        </View>
      ))}
    </View>
  );
}
