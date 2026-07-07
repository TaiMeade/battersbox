import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { OutcomeGrid } from '@/components/OutcomeGrid';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel } from '@/components/ScoreboardPanel';
import { SkLineScore } from '@/components/sk/SkLineScore';
import { Stepper } from '@/components/sk/Stepper';
import { Body, Eyebrow, Mono } from '@/components/typography';
import {
  addLineupSlot,
  addNewPlayerToLineup,
  bumpInningRuns,
  endSkGame,
  logSkPA,
  moveLineupSlot,
  removeLineupSlot,
  scratchLineupSlot,
  setSkGameInning,
  setSkGameOpponent,
  undoSkPA,
  unscratchLineupSlot,
} from '@/db/skRepo';
import { UndoSnackbar } from '@/components/UndoSnackbar';
import { OUTCOME_SPECS, isOutcomeCode, type OutcomeCode } from '@/domain/outcomes';
import { buildLineScore, dueUpSlotId, groupOutcomesByPlayer } from '@/domain/skGame';
import { gameLine } from '@/domain/stats';
import { formatDate } from '@/lib/format';
import {
  useSkGame,
  useSkGamePAs,
  useSkInningRuns,
  useSkLineup,
  useSkRoster,
  type SkLineupRow,
} from '@/hooks/useSkData';
import { useUndoStore } from '@/store/undo';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The Scorekeeper logging screen: line score + steppers up top, the
 * batting order below. The batter who's due up carries an open outcome
 * grid — the common loop is literally one tap per plate appearance.
 */
export default function SkLiveGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const showUndo = useUndoStore((s) => s.show);
  const clearUndo = useUndoStore((s) => s.clear);

  const { game, loading } = useSkGame(id);
  const lineup = useSkLineup(id);
  const pas = useSkGamePAs(id);
  const runRows = useSkInningRuns(id);
  const roster = useSkRoster(game?.teamId);

  const [opponent, setOpponent] = useState('');
  // null = follow the batting order (the due-up row is expanded).
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (game) setOpponent(game.opponent ?? '');
    // Re-sync only when a different game is opened, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  // Game not found (deleted elsewhere) — bail out gracefully, but only after
  // the first read has landed and only while focused (same guard as the
  // player-mode live screen).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && !loading && !game) router.replace('/team');
  }, [isFocused, loading, game, router]);

  const slots = useMemo(
    () =>
      (lineup ?? []).map((row) => ({
        id: row.id,
        battingOrder: row.battingOrder,
        scratched: row.scratchedAt !== null,
      })),
    [lineup],
  );

  const paRows = useMemo(() => {
    const rows: { playerId: string; outcome: OutcomeCode }[] = [];
    for (const pa of pas ?? []) {
      if (isOutcomeCode(pa.outcome)) rows.push({ playerId: pa.playerId, outcome: pa.outcome });
    }
    return rows;
  }, [pas]);
  const byPlayer = useMemo(() => groupOutcomesByPlayer(paRows), [paRows]);

  const lastPa = pas && pas.length > 0 ? pas[pas.length - 1] : undefined;
  const dueUp = dueUpSlotId(slots, lastPa?.lineupSlotId ?? null);
  const activeSlotId = expandedSlotId ?? dueUp;

  // Rotate the display so whoever's due up is always the top card and
  // batters who already hit wrap to the bottom. Edit mode keeps the true
  // batting order so move up/down reads sanely.
  const displayLineup = useMemo(() => {
    const rows = lineup ?? [];
    const idx = editMode || dueUp === null ? -1 : rows.findIndex((row) => row.id === dueUp);
    return idx > 0 ? [...rows.slice(idx), ...rows.slice(0, idx)] : rows;
  }, [lineup, editMode, dueUp]);

  const lineScore = useMemo(
    () => buildLineScore(runRows ?? [], game?.currentInning ?? 1),
    [runRows, game?.currentInning],
  );

  if (!game) return <Screen>{null}</Screen>;

  const currentCell = lineScore.innings.find((cell) => cell.inning === game.currentInning);

  // Bench = active roster players with no slot in this game at all (a player
  // with a scratched slot is un-scratched, not double-slotted, so the box
  // score never splits one player across two rows).
  const slottedPlayerIds = new Set((lineup ?? []).map((row) => row.playerId));
  const bench = (roster ?? []).filter((p) => p.archivedAt === null && !slottedPlayerIds.has(p.id));

  const onOutcome = async (slot: SkLineupRow, code: OutcomeCode) => {
    const pa = await logSkPA(game.id, slot.id, slot.playerId, code);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showUndo({
      label: `${slot.playerName} — ${OUTCOME_SPECS[code].name}`,
      onUndo: () => undoSkPA(pa.id),
    });
    setExpandedSlotId(null); // hand the grid to whoever's due up next
  };

  const onEndGame = async () => {
    clearUndo();
    await endSkGame(game.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/sk-game/[id]/summary', params: { id: game.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to team"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </Pressable>
        <TextInput
          value={opponent}
          onChangeText={setOpponent}
          onEndEditing={() => void setSkGameOpponent(game.id, opponent)}
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
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ScoreboardPanel
          title={formatDate(game.playedOn)}
          right={
            <Eyebrow size={11} color={colors.accent}>
              {paRows.length} PA
            </Eyebrow>
          }
        >
          <SkLineScore lineScore={lineScore} currentInning={game.currentInning} />
          <View style={[styles.stepperRow, { borderTopColor: colors.panelEdge }]}>
            <Stepper
              label="Inning"
              value={game.currentInning}
              onDec={() => void setSkGameInning(game.id, game.currentInning - 1)}
              onInc={() => void setSkGameInning(game.id, game.currentInning + 1)}
              decDisabled={game.currentInning <= 1}
            />
            <Stepper
              label="Us"
              value={currentCell?.us ?? 0}
              onDec={() => void bumpInningRuns(game.id, game.currentInning, 'us', -1)}
              onInc={() => void bumpInningRuns(game.id, game.currentInning, 'us', 1)}
              decDisabled={(currentCell?.us ?? 0) <= 0}
            />
            <Stepper
              label="Them"
              value={currentCell?.them ?? 0}
              onDec={() => void bumpInningRuns(game.id, game.currentInning, 'them', -1)}
              onInc={() => void bumpInningRuns(game.id, game.currentInning, 'them', 1)}
              decDisabled={(currentCell?.them ?? 0) <= 0}
            />
          </View>
        </ScoreboardPanel>

        <View style={styles.lineupHeader}>
          <Eyebrow>Lineup</Eyebrow>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: editMode }}
            onPress={() => setEditMode((v) => !v)}
            hitSlop={8}
            style={styles.editToggle}
          >
            <Eyebrow size={11} color={editMode ? colors.group.onBase.fg : colors.textSoft}>
              {editMode ? 'Done' : 'Edit lineup'}
            </Eyebrow>
            <MaterialCommunityIcons
              name={editMode ? 'check' : 'pencil-outline'}
              size={16}
              color={editMode ? colors.group.onBase.fg : colors.textSoft}
            />
          </Pressable>
        </View>

        {(lineup ?? []).length === 0 || (!editMode && dueUp === null) ? (
          <View style={[styles.hintCard, { borderColor: colors.line }]}>
            <Body color={colors.textSoft} style={{ textAlign: 'center' }}>
              No active batters — tap “Edit lineup” to add or restore players.
            </Body>
          </View>
        ) : null}

        <View style={{ gap: spacing.s }}>
          {displayLineup.map((slot, index) => (
            <LineupRow
              key={slot.id}
              slot={slot}
              outcomes={byPlayer.get(slot.playerId) ?? []}
              isDueUp={slot.id === dueUp}
              expanded={!editMode && slot.id === activeSlotId && slot.scratchedAt === null}
              editMode={editMode}
              isFirst={index === 0}
              isLast={index === displayLineup.length - 1}
              onHeaderTap={() => {
                if (editMode || slot.scratchedAt !== null) return;
                setExpandedSlotId(slot.id === activeSlotId ? null : slot.id);
              }}
              onOutcome={(code) => void onOutcome(slot, code)}
              onMove={(dir) => void moveLineupSlot(game.id, slot.id, dir)}
              onToggleScratch={() =>
                void (slot.scratchedAt === null
                  ? scratchLineupSlot(slot.id)
                  : unscratchLineupSlot(slot.id))
              }
              onRemove={() => {
                void removeLineupSlot(slot.id).then((result) => {
                  if (result === 'scratched') {
                    showUndo({
                      label: `${slot.playerName} scratched (has at-bats)`,
                      onUndo: () => unscratchLineupSlot(slot.id),
                    });
                  }
                });
              }}
            />
          ))}
        </View>

        {editMode && (
          <AddBatters
            bench={bench}
            onAddExisting={(playerId) => void addLineupSlot(game.id, playerId)}
            onAddNew={(name, number) =>
              void addNewPlayerToLineup(game.id, game.teamId, name, number)
            }
          />
        )}
      </ScrollView>

      <View style={{ paddingBottom: spacing.l }}>
        <BigButton label="End game" variant="secondary" onPress={() => void onEndGame()} />
      </View>

      <UndoSnackbar />
    </Screen>
  );
}

function LineupRow({
  slot,
  outcomes,
  isDueUp,
  expanded,
  editMode,
  isFirst,
  isLast,
  onHeaderTap,
  onOutcome,
  onMove,
  onToggleScratch,
  onRemove,
}: {
  slot: SkLineupRow;
  outcomes: OutcomeCode[];
  isDueUp: boolean;
  expanded: boolean;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onHeaderTap: () => void;
  onOutcome: (code: OutcomeCode) => void;
  onMove: (dir: -1 | 1) => void;
  onToggleScratch: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const scratched = slot.scratchedAt !== null;
  const highlight = isDueUp && !editMode;

  return (
    <View
      style={[
        styles.slotCard,
        {
          backgroundColor: colors.card,
          borderColor: highlight ? colors.group.onBase.fg : colors.line,
          borderWidth: highlight ? 2 : 1,
          opacity: scratched ? 0.5 : 1,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          scratched
            ? `${slot.playerName}, scratched`
            : `${slot.playerName}${isDueUp ? ', due up' : ''}. Tap to log an at-bat.`
        }
        onPress={onHeaderTap}
        style={styles.slotHeader}
      >
        <Mono size={13} color={highlight ? colors.group.onBase.fg : colors.textSoft}>
          {String(slot.battingOrder)}
        </Mono>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Body
            size={16}
            style={scratched ? { textDecorationLine: 'line-through' } : undefined}
            color={scratched ? colors.textSoft : colors.text}
            numberOfLines={1}
          >
            {slot.playerName}
          </Body>
          {slot.playerNumber !== null && (
            <Body size={12} color={colors.textSoft}>
              #{slot.playerNumber}
            </Body>
          )}
          {highlight && (
            <Eyebrow size={10} color={colors.group.onBase.fg}>
              Due up
            </Eyebrow>
          )}
        </View>

        {editMode ? (
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <RowIcon name="chevron-up" label="Move up" disabled={isFirst} onPress={() => onMove(-1)} />
            <RowIcon
              name="chevron-down"
              label="Move down"
              disabled={isLast}
              onPress={() => onMove(1)}
            />
            <RowIcon
              name={scratched ? 'account-check-outline' : 'account-off-outline'}
              label={scratched ? 'Restore to lineup' : 'Scratch from lineup'}
              onPress={onToggleScratch}
            />
            <RowIcon name="close" label="Remove from lineup" onPress={onRemove} />
          </View>
        ) : (
          <Mono size={13} color={colors.textSoft}>
            {outcomes.length > 0 ? gameLine(outcomes) : '—'}
          </Mono>
        )}
      </Pressable>

      {expanded && (
        <View style={[styles.gridWrap, { borderTopColor: colors.line }]}>
          <OutcomeGrid compact onSelect={onOutcome} />
        </View>
      )}
    </View>
  );
}

function AddBatters({
  bench,
  onAddExisting,
  onAddNew,
}: {
  bench: { id: string; name: string; number: string | null }[];
  onAddExisting: (playerId: string) => void;
  onAddNew: (name: string, number?: string) => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onAddNew(name, number);
    setName('');
    setNumber('');
  };

  return (
    <View style={{ gap: spacing.s }}>
      <Eyebrow>Add batter</Eyebrow>
      {bench.map((player) => (
        <Pressable
          key={player.id}
          accessibilityRole="button"
          accessibilityLabel={`Add ${player.name} to the lineup`}
          onPress={() => onAddExisting(player.id)}
          style={({ pressed }) => [
            styles.slotCard,
            styles.benchRow,
            { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.textSoft} />
          <Body style={{ flex: 1 }}>{player.name}</Body>
          {player.number !== null && (
            <Body size={12} color={colors.textSoft}>
              #{player.number}
            </Body>
          )}
        </Pressable>
      ))}
      <View style={[styles.slotCard, styles.benchRow, { borderColor: colors.line }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New player"
          placeholderTextColor={colors.textSoft}
          style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text }}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <TextInput
          value={number}
          onChangeText={setNumber}
          placeholder="##"
          placeholderTextColor={colors.textSoft}
          keyboardType="number-pad"
          maxLength={3}
          style={{
            width: 44,
            textAlign: 'center',
            fontFamily: fonts.body,
            fontSize: 15,
            color: colors.textSoft,
          }}
        />
        <RowIcon name="plus-circle-outline" label="Add new player" onPress={submit} />
      </View>
    </View>
  );
}

function RowIcon({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={{ opacity: disabled ? 0.25 : 1, padding: spacing.xs }}
    >
      <MaterialCommunityIcons name={name} size={20} color={colors.textSoft} />
    </Pressable>
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
  stepperRow: {
    flexDirection: 'row',
    gap: spacing.s,
    borderTopWidth: 1,
    paddingTop: spacing.m,
  },
  lineupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintCard: {
    borderWidth: 1,
    borderRadius: radius.m,
    borderStyle: 'dashed',
    padding: spacing.l,
  },
  slotCard: {
    borderRadius: radius.m,
    borderWidth: 1,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    minHeight: 52,
  },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
    minHeight: 48,
  },
  gridWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.m,
  },
});
