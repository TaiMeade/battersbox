import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { eq } from 'drizzle-orm';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel, ScoreStat, ScoreStatRow } from '@/components/ScoreboardPanel';
import { Display, Eyebrow, Mono } from '@/components/typography';
import { db } from '@/db/client';
import { getOpenGame, startGame } from '@/db/repo';
import { seasons, type Season } from '@/db/schema';
import { computeLine, formatAvg } from '@/domain/stats';
import {
  groupOutcomesByGame,
  useSeasonGames,
  useSeasonPAs,
} from '@/hooks/useSeasonData';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Dashboard() {
  // Redirect decision comes from a fresh read on every focus — a live query
  // can lag one render behind right after onboarding creates the season,
  // which would bounce the user straight back to onboarding.
  const [season, setSeason] = useState<Season | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      db.select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .limit(1)
        .then((rows) => {
          if (alive) setSeason(rows[0] ?? null);
        })
        .catch(() => {
          if (alive) setSeason(null);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (season === undefined) return <Screen>{null}</Screen>;
  if (season === null) return <Redirect href="/onboarding" />;
  return <DashboardBody season={season} />;
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
