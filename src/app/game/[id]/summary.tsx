import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BigButton } from '@/components/BigButton';
import { OutcomeGrid } from '@/components/OutcomeGrid';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel, ScoreStat, ScoreStatRow } from '@/components/ScoreboardPanel';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import { db } from '@/db/client';
import { deleteGame, reopenGame, undoPA, updatePAOutcome } from '@/db/repo';
import { games, plateAppearances, type PlateAppearance } from '@/db/schema';
import { OUTCOME_SPECS, isOutcomeCode } from '@/domain/outcomes';
import { computeLine, gameLine } from '@/domain/stats';
import { formatDate, gameTitle } from '@/lib/format';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Game detail: the line, the at-bat sequence, and every fix-it action. */
export default function GameSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState<PlateAppearance | null>(null);

  const { data: gameRows } = useLiveQuery(
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
  const line = useMemo(() => computeLine(outcomes), [outcomes]);

  if (!game) return <Screen>{null}</Screen>;
  const open = game.endedAt === null;

  const onDeleteGame = () => {
    Alert.alert(
      'Delete this game?',
      'Every at-bat in it comes out of your stats. This can’t be undone.',
      [
        { text: 'Keep game', style: 'cancel' },
        {
          text: 'Delete game',
          style: 'destructive',
          onPress: () => {
            void deleteGame(game.id).then(() => router.dismissTo('/'));
          },
        },
      ],
    );
  };

  const onReopen = async () => {
    await reopenGame(game.id);
    router.replace({ pathname: '/game/[id]', params: { id: game.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Display size={24}>{gameTitle(game)}</Display>
          <Body size={13} color={colors.textSoft}>
            {formatDate(game.playedOn)}
          </Body>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.l, paddingBottom: spacing.l }}
        style={{ flex: 1 }}
      >
        <ScoreboardPanel title={open ? 'In progress' : 'Final'}>
          <View style={{ alignItems: 'center' }}>
            <Mono size={26} color={colors.accent}>
              {outcomes.length > 0 ? gameLine(outcomes) : 'No at-bats yet'}
            </Mono>
          </View>
          {outcomes.length > 0 && (
            <ScoreStatRow>
              <ScoreStat label="PA" value={String(line.pa)} size={20} />
              <ScoreStat label="H" value={String(line.h)} size={20} />
              <ScoreStat label="XBH" value={String(line.xbh)} size={20} />
              <ScoreStat label="BB" value={String(line.bb)} size={20} />
              <ScoreStat label="K" value={String(line.k)} size={20} />
            </ScoreStatRow>
          )}
        </ScoreboardPanel>

        {(paRows ?? []).length > 0 && (
          <View style={{ gap: spacing.s }}>
            <Eyebrow>At-bats — tap to fix</Eyebrow>
            <View style={{ gap: spacing.s }}>
              {(paRows ?? []).map((pa, i) => (
                <PARow key={pa.id} pa={pa} index={i + 1} onPress={() => setEditing(pa)} />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: spacing.m }}>
          {open ? (
            // An open game's summary is always pushed from the live screen —
            // go back to it instead of stacking a second copy.
            <BigButton label="Log at-bats" onPress={() => router.back()} />
          ) : (
            <BigButton label="Reopen game" variant="secondary" onPress={() => void onReopen()} />
          )}
          <BigButton label="Delete game" variant="danger" onPress={onDeleteGame} />
        </View>
      </ScrollView>

      <EditPAModal pa={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function PARow({
  pa,
  index,
  onPress,
}: {
  pa: PlateAppearance;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  if (!isOutcomeCode(pa.outcome)) return null;
  const spec = OUTCOME_SPECS[pa.outcome];
  const groupColors = colors.group[spec.group];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`At-bat ${index}: ${spec.name}. Tap to change.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.paRow,
        {
          backgroundColor: pressed ? colors.line : colors.card,
          borderColor: colors.line,
        },
      ]}
    >
      <Mono size={13} color={colors.textSoft}>
        {String(index).padStart(2, '0')}
      </Mono>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: groupColors.fg }}>
        {pa.outcome}
      </Text>
      <Body style={{ flex: 1 }} color={colors.textSoft}>
        {spec.name}
      </Body>
      <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSoft} />
    </Pressable>
  );
}

function EditPAModal({ pa, onClose }: { pa: PlateAppearance | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={pa !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        {pa && (
          <ScrollView contentContainerStyle={{ gap: spacing.l, padding: spacing.l }}>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Eyebrow>At-bat #{pa.seq}</Eyebrow>
              <Display size={22}>
                {isOutcomeCode(pa.outcome) ? OUTCOME_SPECS[pa.outcome].name : pa.outcome}
              </Display>
              <Body size={13} color={colors.textSoft}>
                Pick the correct call, or remove it.
              </Body>
            </View>
            <OutcomeGrid
              compact
              onSelect={(code) => {
                void updatePAOutcome(pa.id, code).then(onClose);
              }}
            />
            <BigButton
              label="Remove at-bat"
              variant="danger"
              onPress={() => {
                void undoPA(pa.id).then(onClose);
              }}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
  },
  paRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    borderWidth: 1,
    paddingBottom: spacing.l,
  },
});
