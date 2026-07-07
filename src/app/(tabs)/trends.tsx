import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OutcomeMixBars } from '@/components/charts/OutcomeMixBars';
import { TrendChart } from '@/components/charts/TrendChart';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel, ScoreStat, ScoreStatRow } from '@/components/ScoreboardPanel';
import { SeasonShareCard } from '@/components/share/ShareCards';
import { SprayField, SprayLegend, type SprayPoint } from '@/components/spray/SprayField';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import { db } from '@/db/client';
import { getSetting, setSetting } from '@/db/repo';
import { players } from '@/db/schema';
import { computeSeasonRecords } from '@/domain/milestones';
import { OUTCOME_SPECS, type OutcomeCode } from '@/domain/outcomes';
import { computeLine, formatAvg, formatRate } from '@/domain/stats';
import { cumulativeTrendPoints, type TrendPoint } from '@/domain/trend';
import {
  groupOutcomesByGame,
  useActiveSeason,
  useCareerOutcomes,
  useSeasonGames,
  useSeasonPAs,
  useSeasons,
} from '@/hooks/useSeasonData';
import { shareViewImage } from '@/lib/shareImage';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Scope = 'season' | 'career';

export default function Trends() {
  const { colors } = useTheme();
  const { season } = useActiveSeason();
  const [scope, setScope] = useState<Scope>('season');

  const seasonPARows = useSeasonPAs(season?.id);
  const seasonGames = useSeasonGames(season?.id);
  const career = useCareerOutcomes();
  const { data: playerRows } = useLiveQuery(db.select().from(players).limit(1));
  const playerName = playerRows?.[0]?.name.trim() || 'Me';

  const outcomes: OutcomeCode[] =
    scope === 'season' ? (seasonPARows ?? []).map((r) => r.outcome) : (career ?? []);
  const line = useMemo(() => computeLine(outcomes), [outcomes]);

  // Don't flash the empty state while the first read is still in flight.
  const loading =
    scope === 'season'
      ? seasonPARows === undefined || seasonGames === undefined
      : career === undefined;

  // Per-game outcome lists in chronological order — the trend line,
  // streaks, and records all build from this.
  const seasonGameOutcomes = useMemo<OutcomeCode[][]>(() => {
    if (!seasonGames || !seasonPARows) return [];
    const byGame = groupOutcomesByGame(seasonPARows);
    return [...seasonGames]
      .reverse()
      .map((g) => byGame.get(g.id) ?? [])
      .filter((o) => o.length > 0);
  }, [seasonGames, seasonPARows]);
  const trendPoints = useMemo(() => cumulativeTrendPoints(seasonGameOutcomes), [seasonGameOutcomes]);

  // Season vs. season compare: overlay another season's cumulative line.
  const allSeasons = useSeasons();
  const compareOptions = allSeasons.filter((s) => s.id !== season?.id);
  const [compareId, setCompareId] = useState<string | null>(null);
  // Resolved through the list so a deleted (or now-active) season falls back to off.
  const compareSeason = compareOptions.find((s) => s.id === compareId);
  const comparePARows = useSeasonPAs(compareSeason?.id);
  const compareGames = useSeasonGames(compareSeason?.id);
  const comparePoints = useMemo<TrendPoint[]>(() => {
    if (!compareGames || !comparePARows) return [];
    const byGame = groupOutcomesByGame(comparePARows);
    return cumulativeTrendPoints([...compareGames].reverse().map((g) => byGame.get(g.id) ?? []));
  }, [compareGames, comparePARows]);

  // Located batted balls for the season spray chart.
  const sprayPoints = useMemo<SprayPoint[]>(() => {
    const pts: SprayPoint[] = [];
    for (const r of seasonPARows ?? []) {
      if (r.sprayX === null || r.sprayY === null) continue;
      const group = OUTCOME_SPECS[r.outcome].group;
      if (group === 'onBase') continue;
      pts.push({ x: r.sprayX, y: r.sprayY, group });
    }
    return pts;
  }, [seasonPARows]);

  const ballsInPlay = useMemo(
    () => (seasonPARows ?? []).filter((r) => OUTCOME_SPECS[r.outcome].inPlay).length,
    [seasonPARows],
  );

  const records = useMemo(() => computeSeasonRecords(seasonGameOutcomes), [seasonGameOutcomes]);

  const shotRef = useRef<View>(null);
  const onShare = () => {
    void shareViewImage(shotRef, 'battersbox-line.png').catch(() =>
      Alert.alert('Couldn’t share', 'Try again in a moment.'),
    );
  };

  // "More stats" stays the way you left it, across sessions.
  const [nerdOpen, setNerdOpen] = useState(false);
  useEffect(() => {
    void getSetting('prefs.nerdStats').then((v) => setNerdOpen(v === '1'));
  }, []);
  const toggleNerd = () => {
    setNerdOpen((open) => {
      void setSetting('prefs.nerdStats', open ? '0' : '1');
      return !open;
    });
  };

  return (
    <Screen>
      <View style={{ paddingVertical: spacing.s, gap: spacing.m }}>
        <Display size={32}>Trends</Display>
        <Chips<Scope>
          options={[
            { key: 'season', label: season ? season.name : 'This season' },
            { key: 'career', label: 'Career' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>

      {loading ? null : line.pa === 0 ? (
        <EmptyState
          icon="📈"
          title="Nothing to chart yet"
          message="Log a few at-bats and your batting line, trend, and outcome mix appear here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xxl }}
        >
          <ScoreboardPanel
            title={scope === 'season' ? 'Season to date' : 'Career'}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share this line as an image"
                onPress={onShare}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={18}
                  color={colors.panelTextSoft}
                />
              </Pressable>
            }
          >
            <ScoreStatRow>
              <ScoreStat label="AVG" value={formatAvg(line.avg)} size={24} />
              <ScoreStat label="OBP" value={formatAvg(line.obp)} size={24} />
              <ScoreStat label="SLG" value={formatAvg(line.slg)} size={24} />
              <ScoreStat label="OPS" value={formatAvg(line.ops)} size={24} />
            </ScoreStatRow>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.xl,
                borderTopWidth: 1,
                borderTopColor: colors.panelEdge,
                paddingTop: spacing.m,
              }}
            >
              <Body size={13} color={colors.panelTextSoft}>
                {line.pa} PA · {line.h} H in {line.ab} AB
              </Body>
              <Body size={13} color={colors.panelTextSoft}>
                K {formatRate(line.kRate)} · BB {formatRate(line.bbRate)}
              </Body>
            </View>
          </ScoreboardPanel>

          <View style={{ gap: spacing.m }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: nerdOpen }}
              accessibilityLabel="More stats"
              onPress={toggleNerd}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Eyebrow>More stats</Eyebrow>
              <MaterialCommunityIcons
                name={nerdOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSoft}
              />
            </Pressable>
            {nerdOpen && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.m,
                  backgroundColor: colors.card,
                }}
              >
                <NerdRow
                  label="wOBA"
                  sub="Every way on base, weighted by its run value"
                  value={formatAvg(line.woba)}
                />
                <NerdRow
                  label="ISO"
                  sub="Isolated power — extra bases per at-bat"
                  value={formatAvg(line.iso)}
                />
                <NerdRow
                  label="BABIP"
                  sub="Batting average when the ball lands in play"
                  value={formatAvg(line.babip)}
                />
                <NerdRow
                  label="K%"
                  sub="Trips that end in a strikeout"
                  value={formatRate(line.kRate)}
                />
                <NerdRow
                  label="BB%"
                  sub="Trips that end in a walk"
                  value={formatRate(line.bbRate)}
                  last
                />
              </View>
            )}
          </View>

          {scope === 'season' && (
            <View style={{ gap: spacing.m }}>
              <Eyebrow>Season trend</Eyebrow>
              {trendPoints.length >= 2 ? (
                <>
                  {compareOptions.length > 0 && (
                    <Chips
                      options={[
                        { key: 'off', label: 'No compare' },
                        ...compareOptions.map((s) => ({ key: s.id, label: `vs ${s.name}` })),
                      ]}
                      value={compareSeason?.id ?? 'off'}
                      onChange={(key) => setCompareId(key === 'off' ? null : key)}
                    />
                  )}
                  <TrendChart
                    points={trendPoints}
                    label={season?.name}
                    compare={
                      compareSeason && comparePoints.length >= 2
                        ? { points: comparePoints, label: compareSeason.name }
                        : undefined
                    }
                  />
                  {compareSeason && comparePoints.length < 2 && (
                    <Body size={13} color={colors.textSoft}>
                      {compareSeason.name} needs at-bats in two games before its line can be
                      drawn.
                    </Body>
                  )}
                </>
              ) : (
                <Body color={colors.textSoft}>
                  Log at-bats in two games and your cumulative AVG and OPS lines start here.
                </Body>
              )}
            </View>
          )}

          <View style={{ gap: spacing.m }}>
            <Eyebrow>Outcome mix</Eyebrow>
            <OutcomeMixBars line={line} />
          </View>

          {scope === 'season' && sprayPoints.length > 0 && (
            <View style={{ gap: spacing.m }}>
              <Eyebrow>Spray chart</Eyebrow>
              <SprayField points={sprayPoints} />
              <SprayLegend points={sprayPoints} />
              {sprayPoints.length < ballsInPlay && (
                <Body size={13} color={colors.textSoft}>
                  {sprayPoints.length} of {ballsInPlay} balls in play have a location — tap the
                  field when you log one to fill this in.
                </Body>
              )}
            </View>
          )}

          {scope === 'season' && seasonGameOutcomes.length > 0 && (
            <View style={{ gap: spacing.m }}>
              <Eyebrow>Season records</Eyebrow>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.m,
                  backgroundColor: colors.card,
                }}
              >
                <RecordRow
                  label="Longest hit streak"
                  value={streakValue(records.longestHitStreak, records.hitStreakLive)}
                />
                <RecordRow
                  label="Longest on-base streak"
                  value={streakValue(records.longestOnBaseStreak, records.onBaseStreakLive)}
                />
                <RecordRow label="Most hits in a game" value={String(records.mostHitsInGame)} />
                <RecordRow
                  label="Most total bases in a game"
                  value={String(records.mostTotalBasesInGame)}
                  last
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Off-screen share image — captured by the panel's share button. */}
      {!loading && line.pa > 0 && (
        <View ref={shotRef} collapsable={false} pointerEvents="none" style={styles.shot}>
          <SeasonShareCard
            width={330}
            title={scope === 'season' ? (season?.name ?? 'This season') : 'Career'}
            subtitle={scope === 'season' ? 'Season to date' : 'Career line'}
            outcomes={outcomes}
            playerName={playerName}
          />
        </View>
      )}
    </Screen>
  );
}

/** "6 games · live" when the best streak is the one still running. */
function streakValue(n: number, live: boolean): string {
  if (n === 0) return '—';
  return `${n} ${n === 1 ? 'game' : 'games'}${live ? ' · live' : ''}`;
}

function NerdRow({
  label,
  sub,
  value,
  last = false,
}: {
  label: string;
  sub: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.m,
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Body size={14}>{label}</Body>
        <Body size={12} color={colors.textSoft}>
          {sub}
        </Body>
      </View>
      <Mono size={16}>{value}</Mono>
    </View>
  );
}

function RecordRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.l,
        paddingVertical: spacing.m,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.line,
      }}
    >
      <Body size={14}>{label}</Body>
      <Mono size={15}>{value}</Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  shot: {
    position: 'absolute',
    top: 0,
    left: -9999,
    width: 330,
  },
});
