import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Eyebrow, Mono } from '@/components/typography';
import type { Game } from '@/db/schema';
import type { OutcomeCode } from '@/domain/outcomes';
import { computeLine, formatAvg, gameLine, type StatLine } from '@/domain/stats';
import { formatDate } from '@/lib/format';
import { fonts, palette, radius, spacing } from '@/theme/tokens';

/**
 * Shareable scoreboard images: the monster-green panel on a chalk backing
 * with the player's name and wordmark. Built from palette constants so a
 * share looks identical no matter which theme the phone is in.
 */

function ShareFrame({
  width,
  playerName,
  children,
}: {
  width: number;
  playerName: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.frame, { width }]}>
      <View style={styles.panel}>{children}</View>
      <View style={styles.frameFooter}>
        <Eyebrow size={10} color={palette.ink}>
          {playerName}
        </Eyebrow>
        <Eyebrow size={10} color={palette.inkSoft}>
          BattersBox
        </Eyebrow>
      </View>
    </View>
  );
}

type MiniKey = 'pa' | 'ab' | 'h' | 'xbh' | 'hr' | 'bb' | 'k';
const MINI_LABELS: Record<MiniKey, string> = {
  pa: 'PA',
  ab: 'AB',
  h: 'H',
  xbh: 'XBH',
  hr: 'HR',
  bb: 'BB',
  k: 'K',
};

function MiniRow({ line, cols }: { line: StatLine; cols: MiniKey[] }) {
  return (
    <View style={styles.miniRow}>
      {cols.map((key) => (
        <View key={key} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Eyebrow size={10} color={palette.monsterTextSoft}>
            {MINI_LABELS[key]}
          </Eyebrow>
          <Mono size={15} color={palette.chalk}>
            {String(line[key])}
          </Mono>
        </View>
      ))}
    </View>
  );
}

export function GameShareCard({
  width,
  game,
  outcomes,
  playerName,
}: {
  width: number;
  game: Game;
  outcomes: OutcomeCode[];
  playerName: string;
}) {
  const line = computeLine(outcomes);
  const [scoreline, notables] = gameLine(outcomes).split(' · ');

  return (
    <ShareFrame width={width} playerName={playerName}>
      <View style={styles.panelHeader}>
        <Eyebrow size={11} color={palette.monsterTextSoft}>
          {game.endedAt === null ? 'In progress' : 'Final'}
        </Eyebrow>
        <Eyebrow size={11} color={palette.monsterTextSoft}>
          {formatDate(game.playedOn)}
        </Eyebrow>
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text numberOfLines={1} style={styles.title}>
          {game.opponent ? `vs ${game.opponent}` : 'Game day'}
        </Text>
        <Mono size={46} color={palette.bulb}>
          {scoreline}
        </Mono>
        {notables ? (
          <Body size={14} color={palette.monsterTextSoft}>
            {notables}
          </Body>
        ) : null}
      </View>
      <MiniRow line={line} cols={['pa', 'h', 'xbh', 'bb', 'k']} />
    </ShareFrame>
  );
}

export function SeasonShareCard({
  width,
  title,
  subtitle,
  outcomes,
  playerName,
}: {
  width: number;
  title: string;
  subtitle: string;
  outcomes: OutcomeCode[];
  playerName: string;
}) {
  const line = computeLine(outcomes);

  return (
    <ShareFrame width={width} playerName={playerName}>
      <View style={styles.panelHeader}>
        <Eyebrow size={11} color={palette.monsterTextSoft}>
          {subtitle}
        </Eyebrow>
        <Eyebrow size={11} color={palette.monsterTextSoft}>
          {line.pa} PA
        </Eyebrow>
      </View>
      <Text numberOfLines={1} style={[styles.title, { textAlign: 'center' }]}>
        {title}
      </Text>
      <View style={{ gap: spacing.l }}>
        <View style={styles.heroRow}>
          <HeroStat label="AVG" value={formatAvg(line.avg)} />
          <HeroStat label="OBP" value={formatAvg(line.obp)} />
        </View>
        <View style={styles.heroRow}>
          <HeroStat label="SLG" value={formatAvg(line.slg)} />
          <HeroStat label="OPS" value={formatAvg(line.ops)} />
        </View>
      </View>
      <MiniRow line={line} cols={['ab', 'h', 'hr', 'bb', 'k']} />
    </ShareFrame>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
      <Eyebrow size={11} color={palette.monsterTextSoft}>
        {label}
      </Eyebrow>
      <Mono size={34} color={palette.bulb}>
        {value}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: palette.chalk,
    padding: spacing.l,
    gap: spacing.m,
  },
  panel: {
    backgroundColor: palette.monster,
    borderColor: palette.monsterEdge,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.l,
    gap: spacing.l,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.monsterEdge,
    paddingBottom: spacing.s,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: palette.chalk,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s,
  },
  miniRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.monsterEdge,
    paddingTop: spacing.m,
  },
  frameFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
});
