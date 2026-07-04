import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { OutcomeGrid } from '@/components/OutcomeGrid';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel } from '@/components/ScoreboardPanel';
import { Body, Eyebrow, Mono } from '@/components/typography';
import { UndoSnackbar } from '@/components/UndoSnackbar';
import { db } from '@/db/client';
import { endGame, logPA, setGameOpponent } from '@/db/repo';
import { games, plateAppearances } from '@/db/schema';
import { OUTCOME_SPECS, isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';
import { gameLine } from '@/domain/stats';
import { formatDate } from '@/lib/format';
import { useUndoStore } from '@/store/undo';
import { fonts, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The logging screen. Big scoreboard tiles, one tap per at-bat,
 * undo instead of confirm. Built for one hand and bright sun.
 */
export default function LiveGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const showUndo = useUndoStore((s) => s.show);
  const clearUndo = useUndoStore((s) => s.clear);

  const { data: gameRows, updatedAt: gameReadAt } = useLiveQuery(
    db.select().from(games).where(eq(games.id, id ?? '')),
    [id],
  );
  const { data: paRows } = useLiveQuery(
    db
      .select()
      .from(plateAppearances)
      .where(eq(plateAppearances.gameId, id ?? ''))
      .orderBy(asc(plateAppearances.seq)),
    [id],
  );

  const game = gameRows?.[0];
  const outcomes = useMemo(
    () => (paRows ?? []).map((pa) => pa.outcome).filter(isOutcomeCode),
    [paRows],
  );

  const [opponent, setOpponent] = useState('');
  useEffect(() => {
    if (game) setOpponent(game.opponent ?? '');
    // Re-sync only when a different game is opened, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  // Game not found (deleted elsewhere) — bail out gracefully. Two guards:
  // only while focused (firing mid-transition double-navigates), and only
  // after the first read has landed — drizzle's useLiveQuery starts with
  // data = [] (not undefined), so an empty array means nothing until
  // updatedAt is set.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && gameReadAt !== undefined && gameRows.length === 0) router.replace('/');
  }, [isFocused, gameReadAt, gameRows, router]);

  if (!game) return <Screen>{null}</Screen>;

  const onOutcome = async (code: OutcomeCode) => {
    const pa = await logPA(game.id, code);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showUndo({ paId: pa.id, label: `Logged: ${OUTCOME_SPECS[code].name}` });
  };

  const onEndGame = async () => {
    clearUndo();
    await endGame(game.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/game/[id]/summary', params: { id: game.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </Pressable>
        <TextInput
          value={opponent}
          onChangeText={setOpponent}
          onEndEditing={() => void setGameOpponent(game.id, opponent)}
          placeholder="Add opponent"
          placeholderTextColor={colors.textSoft}
          style={[styles.opponentInput, { color: colors.text }]}
          returnKeyType="done"
        />
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.l, paddingBottom: spacing.l }}
        style={{ flex: 1 }}
      >
        <ScoreboardPanel
          title={formatDate(game.playedOn)}
          right={
            <Eyebrow size={11} color={colors.accent}>
              {outcomes.length} PA
            </Eyebrow>
          }
        >
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Eyebrow size={11} color={colors.panelTextSoft}>
              Today
            </Eyebrow>
            <Mono size={26} color={colors.accent}>
              {outcomes.length > 0 ? gameLine(outcomes) : 'Step in'}
            </Mono>
          </View>
          {outcomes.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/game/[id]/summary', params: { id: game.id } })
              }
              hitSlop={8}
              style={{ alignItems: 'center' }}
            >
              <Body size={13} color={colors.panelTextSoft}>
                Review at-bats →
              </Body>
            </Pressable>
          )}
        </ScoreboardPanel>

        <OutcomeGrid onSelect={(code) => void onOutcome(code)} />
      </ScrollView>

      <View style={{ paddingBottom: spacing.l }}>
        <BigButton label="End game" variant="secondary" onPress={() => void onEndGame()} />
      </View>

      <UndoSnackbar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
  },
  opponentInput: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 22,
    paddingVertical: spacing.xs,
  },
});
