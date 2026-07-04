import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatAvg, type StatLine } from '@/domain/stats';
import { fonts } from '@/theme/tokens';

/**
 * A printed baseball card. Like the scoreboard panel, it's a physical
 * object inside the app's world, so its colors never follow the theme:
 * glossy chalk stock on the front, tan cardboard on the back, printed in
 * one ink (scoreboard green) with a clay second ink for rules — the way
 * real 1970s card backs came off the press.
 */
export const CARD_RATIO = 3.5 / 2.5; // real cards are 2.5" × 3.5"

const card = {
  stock: '#FDFCF7', // front border — glossy card stock
  board: '#E9DCB7', // back — tan cardboard
  ink: '#1E4634', // the print ink (scoreboard green)
  inkFaint: 'rgba(30, 70, 52, 0.18)',
  inkSoft: 'rgba(30, 70, 52, 0.65)',
  accent: '#8F3D1E', // second ink — rules, headers, the trivia star
  accentSoft: 'rgba(143, 61, 30, 0.55)',
  chalk: '#F5F3EA',
  chalkSoft: '#A8C2B1',
  bulb: '#FFB53C',
  onBulb: '#1A231D',
  onStock: 'rgba(26, 35, 29, 0.55)',
};

export interface CardIdentity {
  name: string;
  team: string;
  position: string; // '' hides the front badge
  number: string; // '' falls back to "1" on the back
  year: string;
}

// ---------------------------------------------------------------- front

export function CardFront({
  width,
  identity,
  photoUri,
}: {
  width: number;
  identity: CardIdentity;
  photoUri: string | null;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showPhoto = photoUri !== null && photoUri !== failedUri;

  return (
    <View style={[styles.face, { width, height: Math.round(width * CARD_RATIO) }, styles.front]}>
      <View style={styles.window}>
        {showPhoto ? (
          <Image
            source={{ uri: photoUri }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            onError={() => setFailedUri(photoUri)}
          />
        ) : (
          <View style={styles.placeholder}>
            <BallMonogram size={Math.round(width * 0.44)} initials={initialsOf(identity.name)} />
          </View>
        )}
      </View>

      <View style={styles.banner}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={styles.name}>
            {identity.name}
          </Text>
          <Text numberOfLines={1} style={styles.bannerSub}>
            {identity.team}
          </Text>
        </View>
        {identity.position ? (
          <View style={styles.badge}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.badgeText}>
              {identity.position}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.frontFooter}>
        <Text style={styles.wordmark}>BATTERSBOX</Text>
        <Text style={styles.yearStamp}>{identity.year}</Text>
      </View>
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** The no-photo front: a chalk baseball wearing the player's monogram. */
function BallMonogram({ size, initials }: { size: number; initials: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={46} fill={card.chalk} />
        <Path
          d="M 30 9 A 60 60 0 0 1 30 91"
          stroke={card.accent}
          strokeWidth={2.6}
          strokeDasharray="5 4"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 70 9 A 60 60 0 0 0 70 91"
          stroke={card.accent}
          strokeWidth={2.6}
          strokeDasharray="5 4"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- back

export interface CardStatRow {
  label: string;
  games: number;
  line: StatLine;
}

const COLS = [
  { label: 'G', flex: 1 },
  { label: 'AB', flex: 1.15 },
  { label: 'H', flex: 1 },
  { label: 'HR', flex: 1.15 },
  { label: 'BB', flex: 1.15 },
  { label: 'K', flex: 1 },
  { label: 'AVG', flex: 1.7 },
  { label: 'OPS', flex: 1.7 },
] as const;

function cellsFor(games: number, line: StatLine): string[] {
  return [
    String(games),
    String(line.ab),
    String(line.h),
    String(line.hr),
    String(line.bb),
    String(line.k),
    formatAvg(line.avg),
    formatAvg(line.ops),
  ];
}

export function CardBack({
  width,
  identity,
  rows,
  career,
  careerGames,
  trivia,
}: {
  width: number;
  identity: CardIdentity;
  rows: CardStatRow[];
  career: StatLine;
  careerGames: number;
  trivia: string;
}) {
  // The six most recent seasons get printed rows; LIFETIME carries the rest.
  const printed = rows.slice(-6);
  const subtitle =
    [identity.position, identity.team].filter(Boolean).join(' · ') || `Season ${identity.year}`;

  return (
    <View style={[styles.face, { width, height: Math.round(width * CARD_RATIO) }, styles.back]}>
      <View style={styles.backHeader}>
        <View style={styles.numberRing}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.numberText}>
            {identity.number || '1'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.backName}>
            {identity.name}
          </Text>
          <Text numberOfLines={1} style={styles.backSub}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <View style={{ height: 2, backgroundColor: card.accent }} />
        <View style={{ height: 1, backgroundColor: card.accent }} />
      </View>

      <Text style={styles.recordTitle}>Complete Batting Record</Text>

      <View>
        <TableRow header label="Season" cells={COLS.map((c) => c.label)} />
        {printed.map((row, i) => (
          <TableRow key={`${i}-${row.label}`} label={row.label} cells={cellsFor(row.games, row.line)} />
        ))}
        <TableRow lifetime label="Lifetime" cells={cellsFor(careerGames, career)} />
      </View>

      <View style={styles.triviaBox}>
        <Text style={styles.triviaStar}>★</Text>
        <Text style={styles.triviaText}>{trivia}</Text>
      </View>

      <View style={styles.backFooter}>
        <View style={styles.footerRule} />
        <Text style={styles.backWordmark}>BATTERSBOX · PRINTED FROM REAL AT-BATS</Text>
      </View>
    </View>
  );
}

function TableRow({
  label,
  cells,
  header = false,
  lifetime = false,
}: {
  label: string;
  cells: readonly string[];
  header?: boolean;
  lifetime?: boolean;
}) {
  const strong = header || lifetime;
  return (
    <View style={[styles.tableRow, header && styles.headRow, lifetime && styles.lifetimeRow]}>
      <Text
        numberOfLines={1}
        style={[styles.seasonCell, strong && { fontFamily: fonts.displayBold }]}
      >
        {label}
      </Text>
      {cells.map((cell, i) => (
        <Text
          key={COLS[i].label}
          numberOfLines={1}
          style={[
            styles.numCell,
            { flex: COLS[i].flex },
            strong && { fontFamily: fonts.monoBold },
          ]}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- styles

const styles = StyleSheet.create({
  face: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26, 35, 29, 0.12)',
  },
  front: {
    backgroundColor: card.stock,
    padding: 10,
    gap: 8,
  },
  back: {
    backgroundColor: card.board,
    padding: 12,
    gap: 8,
  },

  // front
  window: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: card.ink,
    backgroundColor: card.ink,
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    position: 'absolute',
    fontFamily: fonts.displayBold,
    color: card.ink,
    letterSpacing: 1,
  },
  banner: {
    backgroundColor: card.ink,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: card.chalk,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerSub: {
    fontFamily: fonts.displayBold,
    fontSize: 9.5,
    color: card.chalkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: card.bulb,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    color: card.onBulb,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  frontFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 8,
    letterSpacing: 2,
    color: card.onStock,
  },
  yearStamp: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    color: card.onStock,
  },

  // back
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numberRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: card.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  numberText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
    color: card.ink,
  },
  backName: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: card.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  backSub: {
    fontFamily: fonts.displayBold,
    fontSize: 9,
    color: card.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  recordTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 10,
    color: card.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: card.inkFaint,
  },
  headRow: {
    borderTopWidth: 1.2,
    borderTopColor: card.ink,
    borderBottomWidth: 1.2,
    borderBottomColor: card.ink,
  },
  lifetimeRow: {
    borderTopWidth: 1.2,
    borderTopColor: card.ink,
    borderBottomWidth: 0,
  },
  seasonCell: {
    flex: 2.6,
    fontFamily: fonts.display,
    fontSize: 9.5,
    color: card.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  numCell: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: card.ink,
    textAlign: 'center',
  },
  triviaBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: card.accentSoft,
    borderRadius: 6,
    padding: 8,
  },
  triviaStar: {
    fontSize: 10,
    lineHeight: 15,
    color: card.accent,
  },
  triviaText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    lineHeight: 15,
    color: card.ink,
  },
  backFooter: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 4,
  },
  footerRule: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(30, 70, 52, 0.35)',
  },
  backWordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: card.inkSoft,
  },
});
