import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { OutcomeGrid } from '@/components/OutcomeGrid';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel } from '@/components/ScoreboardPanel';
import { SkLineScore } from '@/components/sk/SkLineScore';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import { deleteSkGame, reopenSkGame, undoSkPA, updateSkPAOutcome } from '@/db/skRepo';
import type { SkPlateAppearance } from '@/db/schema';
import { OUTCOME_SPECS, isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';
import { buildBoxScore, buildLineScore, gameResult, type BoxScoreRow } from '@/domain/skGame';
import { formatAvg } from '@/domain/stats';
import { formatDate, gameTitle } from '@/lib/format';
import {
  useSkGame,
  useSkGamePAs,
  useSkInningRuns,
  useSkLineup,
} from '@/hooks/useSkData';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const RESULT_LABEL = { W: 'Win', L: 'Loss', T: 'Tie' } as const;

/** The box score: line score, per-player lines, and the fix-anything at-bat log. */
export default function SkGameSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState<SkPlateAppearance | null>(null);

  const { game } = useSkGame(id);
  const lineup = useSkLineup(id);
  const pas = useSkGamePAs(id);
  const runRows = useSkInningRuns(id);

  const paRows = useMemo(() => {
    const rows: { playerId: string; outcome: OutcomeCode }[] = [];
    for (const pa of pas ?? []) {
      if (isOutcomeCode(pa.outcome)) rows.push({ playerId: pa.playerId, outcome: pa.outcome });
    }
    return rows;
  }, [pas]);

  const box = useMemo(() => {
    const slots = (lineup ?? []).map((row) => ({
      id: row.id,
      playerId: row.playerId,
      battingOrder: row.battingOrder,
      scratched: row.scratchedAt !== null,
    }));
    const names = new Map((lineup ?? []).map((row) => [row.playerId, row.playerName]));
    return buildBoxScore(slots, names, paRows);
  }, [lineup, paRows]);

  const lineScore = useMemo(
    () => buildLineScore(runRows ?? [], game?.currentInning ?? 1),
    [runRows, game?.currentInning],
  );

  const nameBySlot = useMemo(
    () => new Map((lineup ?? []).map((row) => [row.id, row.playerName])),
    [lineup],
  );

  if (!game) return <Screen>{null}</Screen>;
  const open = game.endedAt === null;
  const result = gameResult(lineScore.usTotal, lineScore.themTotal);

  const onDeleteGame = () => {
    Alert.alert('Delete this game?', 'The box score and every at-bat in it go with it.', [
      { text: 'Keep game', style: 'cancel' },
      {
        text: 'Delete game',
        style: 'destructive',
        onPress: () => {
          void deleteSkGame(game.id).then(() => router.dismissTo('/team'));
        },
      },
    ]);
  };

  const onReopen = async () => {
    await reopenSkGame(game.id);
    router.replace({ pathname: '/sk-game/[id]', params: { id: game.id } });
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
          <SkLineScore lineScore={lineScore} currentInning={open ? game.currentInning : undefined} />
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Mono size={30} color={colors.accent}>
              {`${lineScore.usTotal} — ${lineScore.themTotal}`}
            </Mono>
            {!open && (
              <Eyebrow size={11} color={colors.panelTextSoft}>
                {RESULT_LABEL[result]}
              </Eyebrow>
            )}
          </View>
        </ScoreboardPanel>

        {box.rows.length > 0 && (
          <View style={{ gap: spacing.s }}>
            <Eyebrow>Box score</Eyebrow>
            <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <BoxHeaderRow />
              {box.rows.map((row) => (
                <BoxRow key={row.slotId} row={row} />
              ))}
              <View style={[styles.teamRow, { borderTopColor: colors.line }]}>
                <BoxCells
                  name="Team"
                  bold
                  ab={box.team.ab}
                  h={box.team.h}
                  bb={box.team.bb}
                  k={box.team.k}
                  avg={formatAvg(box.team.avg)}
                />
              </View>
            </View>
          </View>
        )}

        {(pas ?? []).length > 0 && (
          <View style={{ gap: spacing.s }}>
            <Eyebrow>At-bats — tap to fix</Eyebrow>
            <View style={{ gap: spacing.s }}>
              {(pas ?? []).map((pa) => (
                <SkPARow
                  key={pa.id}
                  pa={pa}
                  playerName={nameBySlot.get(pa.lineupSlotId) ?? 'Unknown'}
                  onPress={() => setEditing(pa)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: spacing.m }}>
          {open ? (
            <BigButton label="Log at-bats" onPress={() => router.back()} />
          ) : (
            <BigButton label="Reopen game" variant="secondary" onPress={() => void onReopen()} />
          )}
          <BigButton label="Delete game" variant="danger" onPress={onDeleteGame} />
        </View>
      </ScrollView>

      <EditSkPAModal
        pa={editing}
        playerName={editing ? (nameBySlot.get(editing.lineupSlotId) ?? '') : ''}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

function BoxHeaderRow() {
  const { colors } = useTheme();
  return (
    <View style={styles.boxRow}>
      <Eyebrow size={10} color={colors.textSoft} style={{ flex: 1 }}>
        Batter
      </Eyebrow>
      {['AB', 'H', 'BB', 'K'].map((label) => (
        <Eyebrow key={label} size={10} color={colors.textSoft} style={styles.numCell}>
          {label}
        </Eyebrow>
      ))}
      <Eyebrow size={10} color={colors.textSoft} style={styles.avgCell}>
        AVG
      </Eyebrow>
    </View>
  );
}

function BoxRow({ row }: { row: BoxScoreRow }) {
  const { colors } = useTheme();
  return (
    <View style={styles.boxRow}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
        <Mono size={12} color={colors.textSoft}>
          {String(row.battingOrder)}
        </Mono>
        <Body
          size={14}
          numberOfLines={1}
          color={row.scratched ? colors.textSoft : colors.text}
          style={[{ flexShrink: 1 }, row.scratched && { textDecorationLine: 'line-through' }]}
        >
          {row.name}
        </Body>
      </View>
      <Mono size={14} style={styles.numCell}>
        {String(row.line.ab)}
      </Mono>
      <Mono size={14} style={styles.numCell}>
        {String(row.line.h)}
      </Mono>
      <Mono size={14} style={styles.numCell}>
        {String(row.line.bb)}
      </Mono>
      <Mono size={14} style={styles.numCell}>
        {String(row.line.k)}
      </Mono>
      <Mono size={14} style={styles.avgCell}>
        {formatAvg(row.line.avg)}
      </Mono>
    </View>
  );
}

function BoxCells({
  name,
  ab,
  h,
  bb,
  k,
  avg,
  bold = false,
}: {
  name: string;
  ab: number;
  h: number;
  bb: number;
  k: number;
  avg: string;
  bold?: boolean;
}) {
  const font = bold ? fonts.monoBold : fonts.monoSemiBold;
  return (
    <>
      <Body size={14} style={{ flex: 1, fontFamily: bold ? fonts.bodySemiBold : fonts.body }}>
        {name}
      </Body>
      {[ab, h, bb, k].map((value, i) => (
        <Mono key={i} size={14} style={[styles.numCell, { fontFamily: font }]}>
          {String(value)}
        </Mono>
      ))}
      <Mono size={14} style={[styles.avgCell, { fontFamily: font }]}>
        {avg}
      </Mono>
    </>
  );
}

function SkPARow({
  pa,
  playerName,
  onPress,
}: {
  pa: SkPlateAppearance;
  playerName: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  if (!isOutcomeCode(pa.outcome)) return null;
  const spec = OUTCOME_SPECS[pa.outcome];
  const groupColors = colors.group[spec.group];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`At-bat ${pa.seq}, inning ${pa.inning}: ${playerName}, ${spec.name}. Tap to change.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.paRow,
        { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line },
      ]}
    >
      <Mono size={13} color={colors.textSoft}>
        {String(pa.seq).padStart(2, '0')}
      </Mono>
      <Eyebrow size={10} color={colors.textSoft}>
        In {pa.inning}
      </Eyebrow>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: groupColors.fg }}>
        {pa.outcome}
      </Text>
      <Body style={{ flex: 1 }} numberOfLines={1} color={colors.textSoft}>
        {playerName}
      </Body>
      <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSoft} />
    </Pressable>
  );
}

function EditSkPAModal({
  pa,
  playerName,
  onClose,
}: {
  pa: SkPlateAppearance | null;
  playerName: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={pa !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        {pa && (
          <ScrollView contentContainerStyle={{ gap: spacing.l, padding: spacing.l }}>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Eyebrow>
                {playerName} — at-bat #{pa.seq}
              </Eyebrow>
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
                void updateSkPAOutcome(pa.id, code).then(onClose);
              }}
            />
            <BigButton
              label="Remove at-bat"
              variant="danger"
              onPress={() => {
                void undoSkPA(pa.id).then(onClose);
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
  table: {
    borderRadius: radius.m,
    borderWidth: 1,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  numCell: {
    width: 30,
    textAlign: 'right',
  },
  avgCell: {
    width: 48,
    textAlign: 'right',
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
