import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { eq } from 'drizzle-orm';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel, ScoreStat, ScoreStatRow } from '@/components/ScoreboardPanel';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import { db } from '@/db/client';
import { getOpenGame, setSeasonGoals, startGame } from '@/db/repo';
import { getAppMode, setAppMode } from '@/db/skRepo';
import { seasons, type Season } from '@/db/schema';
import {
  goalProgress,
  hasAnyGoal,
  parseCountTarget,
  parseRateTarget,
  type SeasonGoals,
} from '@/domain/goals';
import { computeLine, formatAvg, type StatLine } from '@/domain/stats';
import {
  groupOutcomesByGame,
  useSeasonGames,
  useSeasonGoals,
  useSeasonPAs,
} from '@/hooks/useSeasonData';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Gate = 'loading' | 'sk' | 'onboarding' | { season: Season };

export default function Dashboard() {
  // Redirect decisions come from a fresh read on every focus — a live query
  // can lag one render behind right after onboarding creates the season,
  // which would bounce the user straight back to onboarding. The app.mode
  // check runs first: Expo Router always cold-starts at "/", so this gate
  // is also what restores Scorekeeper Mode after a relaunch.
  const [gate, setGate] = useState<Gate>('loading');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        try {
          if ((await getAppMode()) === 'scorekeeper') {
            if (alive) setGate('sk');
            return;
          }
          const rows = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
          if (alive) setGate(rows[0] ? { season: rows[0] } : 'onboarding');
        } catch {
          if (alive) setGate('onboarding');
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  if (gate === 'loading') return <Screen>{null}</Screen>;
  if (gate === 'sk') return <Redirect href="/team" />;
  if (gate === 'onboarding') return <Redirect href="/onboarding" />;
  return <DashboardBody season={gate.season} />;
}

function DashboardBody({ season }: { season: Season }) {
  const { colors } = useTheme();
  const router = useRouter();
  const games = useSeasonGames(season.id);
  const paRows = useSeasonPAs(season.id);
  const [starting, setStarting] = useState(false);

  const line = useMemo(() => computeLine((paRows ?? []).map((r) => r.outcome)), [paRows]);
  const byGame = useMemo(() => groupOutcomesByGame(paRows ?? []), [paRows]);

  const openGame = games?.find((g) => g.endedAt === null);
  const recent = (games ?? []).slice(0, 5);

  const onPrimary = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Ask the DB directly instead of trusting render state — right after
      // mount the live query hasn't landed yet, and "starting" a game while
      // one is already open would create a duplicate.
      const game = (await getOpenGame(season.id)) ?? (await startGame(season.id));
      router.push({ pathname: '/game/[id]', params: { id: game.id } });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: spacing.s,
        }}
      >
        <Display size={32}>Batter&apos;s Box</Display>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.l }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to Scorekeeper Mode"
            hitSlop={8}
            onPress={() => {
              void (async () => {
                // Write the mode before navigating so the focus gate can't
                // bounce us straight back here.
                await setAppMode('scorekeeper');
                router.replace('/team');
              })();
            }}
          >
            <MaterialCommunityIcons name="scoreboard-outline" size={24} color={colors.textSoft} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your baseball card"
            hitSlop={8}
            onPress={() => router.push('/card')}
          >
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={24}
              color={colors.textSoft}
            />
          </Pressable>
          <Text style={{ fontSize: 24 }}>{season.sport === 'softball' ? '🥎' : '⚾'}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.l, paddingBottom: spacing.l }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ScoreboardPanel title={season.name}>
          {/* 2×2 so five-glyph values like 1.000 never wrap on narrow phones. */}
          <View style={{ gap: spacing.l }}>
            <ScoreStatRow>
              <ScoreStat label="AVG" value={formatAvg(line.avg)} size={36} />
              <ScoreStat label="OBP" value={formatAvg(line.obp)} size={36} />
            </ScoreStatRow>
            <ScoreStatRow>
              <ScoreStat label="SLG" value={formatAvg(line.slg)} size={36} />
              <ScoreStat label="OPS" value={formatAvg(line.ops)} size={36} />
            </ScoreStatRow>
          </View>
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: colors.panelEdge,
              paddingTop: spacing.m,
            }}
          >
            <MiniStat label="PA" value={line.pa} />
            <MiniStat label="AB" value={line.ab} />
            <MiniStat label="H" value={line.h} />
            <MiniStat label="HR" value={line.hr} />
            <MiniStat label="BB" value={line.bb} />
            <MiniStat label="K" value={line.k} />
          </View>
        </ScoreboardPanel>

        <GoalsSection season={season} line={line} />

        {games === undefined ? null : recent.length > 0 ? (
          <View style={{ gap: spacing.s }}>
            <Eyebrow>Recent games</Eyebrow>
            <View style={{ gap: spacing.s }}>
              {recent.map((game) => (
                <GameRow key={game.id} game={game} outcomes={byGame.get(game.id) ?? []} />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState
            icon="⚾"
            title="Play ball"
            message="Start a game below and tap each at-bat as it happens. Your line builds itself."
          />
        )}
      </ScrollView>

      <View style={{ paddingBottom: spacing.l }}>
        <BigButton
          label={openGame ? 'Resume game' : 'Start game'}
          onPress={() => void onPrimary()}
          disabled={starting || games === undefined}
        />
      </View>
    </Screen>
  );
}

/**
 * Season goals: quiet progress meters under the scoreboard. No goals set →
 * a single soft "+ Season goals" line; the pencil flips the card into an
 * inline editor (targets save as you leave each field).
 */
function GoalsSection({ season, line }: { season: Season; line: StatLine }) {
  const { colors } = useTheme();
  const goals = useSeasonGoals(season.id);
  const [editing, setEditing] = useState(false);

  if (goals === undefined) return null;

  if (!hasAnyGoal(goals) && !editing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set season goals"
        onPress={() => setEditing(true)}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', paddingVertical: spacing.xs }}
      >
        <Body size={14} color={colors.textSoft}>
          + Season goals
        </Body>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.s }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Eyebrow>Goals</Eyebrow>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: editing }}
          onPress={() => setEditing((v) => !v)}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Eyebrow size={11} color={editing ? colors.group.onBase.fg : colors.textSoft}>
            {editing ? 'Done' : 'Edit'}
          </Eyebrow>
          <MaterialCommunityIcons
            name={editing ? 'check' : 'pencil-outline'}
            size={16}
            color={editing ? colors.group.onBase.fg : colors.textSoft}
          />
        </Pressable>
      </View>

      {editing ? (
        <GoalsEditor seasonId={season.id} goals={goals} />
      ) : (
        <View style={[styles.goalsCard, { borderColor: colors.line, backgroundColor: colors.card }]}>
          {goals.avg !== null && (
            <GoalMeterRow
              label="AVG"
              current={formatAvg(line.avg)}
              target={formatAvg(goals.avg)}
              progress={goalProgress(line.avg, goals.avg)}
              met={line.avg !== null && line.avg >= goals.avg}
              last={goals.obp === null && goals.hr === null}
            />
          )}
          {goals.obp !== null && (
            <GoalMeterRow
              label="OBP"
              current={formatAvg(line.obp)}
              target={formatAvg(goals.obp)}
              progress={goalProgress(line.obp, goals.obp)}
              met={line.obp !== null && line.obp >= goals.obp}
              last={goals.hr === null}
            />
          )}
          {goals.hr !== null && (
            <GoalMeterRow
              label="HR"
              current={String(line.hr)}
              target={String(goals.hr)}
              progress={goalProgress(line.hr, goals.hr)}
              met={line.hr >= goals.hr}
              last
            />
          )}
        </View>
      )}
    </View>
  );
}

/** One goal: label, thin meter (fill + lighter track of the same hue), current / target. */
function GoalMeterRow({
  label,
  current,
  target,
  progress,
  met,
  last = false,
}: {
  label: string;
  current: string;
  target: string;
  progress: number;
  met: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} goal: ${current} of ${target}${met ? ', met' : ''}`}
      style={[
        styles.goalRow,
        { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.line },
      ]}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Body size={14}>{label}</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {met && (
            <MaterialCommunityIcons name="check-circle" size={14} color={colors.chart.avg} />
          )}
          <Mono size={14}>{current}</Mono>
          <Body size={12} color={colors.textSoft}>
            {`/ ${target}`}
          </Body>
        </View>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: `${colors.chart.avg}33` }]}>
        <View
          style={[
            styles.meterFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.chart.avg },
          ]}
        />
      </View>
    </View>
  );
}

function GoalsEditor({ seasonId, goals }: { seasonId: string; goals: SeasonGoals }) {
  const { colors } = useTheme();
  const save = (patch: Partial<SeasonGoals>) =>
    void setSeasonGoals(seasonId, { ...goals, ...patch });
  return (
    <View style={{ gap: spacing.s }}>
      <View style={[styles.goalsCard, { borderColor: colors.line, backgroundColor: colors.card }]}>
        <GoalInput
          label="AVG"
          hint="Batting average"
          placeholder=".300"
          defaultValue={goals.avg !== null ? formatAvg(goals.avg) : ''}
          keyboardType="decimal-pad"
          onCommit={(text) => save({ avg: parseRateTarget(text) })}
        />
        <GoalInput
          label="OBP"
          hint="On-base percentage"
          placeholder=".400"
          defaultValue={goals.obp !== null ? formatAvg(goals.obp) : ''}
          keyboardType="decimal-pad"
          onCommit={(text) => save({ obp: parseRateTarget(text) })}
        />
        <GoalInput
          label="HR"
          hint="Home runs"
          placeholder="5"
          defaultValue={goals.hr !== null ? String(goals.hr) : ''}
          keyboardType="number-pad"
          onCommit={(text) => save({ hr: parseCountTarget(text) })}
          last
        />
      </View>
      <Body size={12} color={colors.textSoft}>
        Clear a target to drop that goal.
      </Body>
    </View>
  );
}

function GoalInput({
  label,
  hint,
  placeholder,
  defaultValue,
  keyboardType,
  onCommit,
  last = false,
}: {
  label: string;
  hint: string;
  placeholder: string;
  defaultValue: string;
  keyboardType: 'decimal-pad' | 'number-pad';
  onCommit: (text: string) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.goalRow,
        styles.goalInputRow,
        { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.line },
      ]}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Body size={14}>{label}</Body>
        <Body size={12} color={colors.textSoft}>
          {hint}
        </Body>
      </View>
      <TextInput
        accessibilityLabel={`${label} target`}
        defaultValue={defaultValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        keyboardType={keyboardType}
        onEndEditing={(e) => onCommit(e.nativeEvent.text)}
        returnKeyType="done"
        style={[styles.goalInput, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  goalsCard: {
    borderWidth: 1,
    borderRadius: radius.m,
  },
  goalRow: {
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
    minHeight: 52,
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalInput: {
    width: 80,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 16,
    paddingVertical: spacing.xs,
  },
});

function MiniStat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Eyebrow size={10} color={colors.panelTextSoft}>
        {label}
      </Eyebrow>
      <Mono size={15} color={colors.panelText}>
        {String(value)}
      </Mono>
    </View>
  );
}
