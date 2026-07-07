import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { ScoreboardPanel, ScoreStat, ScoreStatRow } from '@/components/ScoreboardPanel';
import { Body, Display, Eyebrow, Mono } from '@/components/typography';
import {
  addRosterPlayer,
  createSkTeam,
  getOpenSkGame,
  moveRosterPlayer,
  removeRosterPlayer,
  renameSkTeam,
  setActiveSkTeam,
  setAppMode,
  startSkGame,
  unarchiveRosterPlayer,
  updateRosterPlayer,
} from '@/db/skRepo';
import type { SkPlayer, SkTeam } from '@/db/schema';
import type { OutcomeCode } from '@/domain/outcomes';
import { gameResult, groupOutcomesByPlayer } from '@/domain/skGame';
import { computeLine, formatAvg } from '@/domain/stats';
import {
  useActiveSkTeamId,
  useSkAllInningRuns,
  useSkRoster,
  useSkTeamGames,
  useSkTeamPAs,
  useSkTeams,
} from '@/hooks/useSkData';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The Scorekeeper dashboard: cumulative team line, per-player season
 * stats, roster management, and the start/resume button. Everything on
 * this side of the mode switch reads sk_* tables only.
 */
export default function TeamScreen() {
  const teams = useSkTeams();
  const activeTeamId = useActiveSkTeamId();

  if (teams === undefined || activeTeamId === undefined) return <Screen>{null}</Screen>;
  if (teams.length === 0) return <CreateFirstTeam />;

  const team = teams.find((t) => t.id === activeTeamId) ?? teams[0];
  return <TeamBody key={team.id} team={team} teams={teams} />;
}

/** Header icon that hops back to Player Mode (writes the KV before navigating). */
function SwitchToPlayerButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Switch to Player Mode"
      hitSlop={8}
      onPress={() => {
        void (async () => {
          await setAppMode('player');
          router.replace('/');
        })();
      }}
    >
      <MaterialCommunityIcons name="account-circle-outline" size={24} color={colors.textSoft} />
    </Pressable>
  );
}

function CreateFirstTeam() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createSkTeam(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Eyebrow>Scorekeeper</Eyebrow>
          <Display size={32}>New team</Display>
        </View>
        <SwitchToPlayerButton />
      </View>
      <View style={{ gap: spacing.l, paddingTop: spacing.l }}>
        <Body color={colors.textSoft} style={{ lineHeight: 22 }}>
          Score a whole game for your team — lineup, innings, box score. Kept completely separate
          from your personal stats.
        </Body>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Team name"
          placeholderTextColor={colors.textSoft}
          style={[
            styles.input,
            { borderColor: colors.line, color: colors.text, backgroundColor: colors.card },
          ]}
          returnKeyType="done"
        />
        <BigButton label="Create team" onPress={() => void onCreate()} disabled={busy} />
      </View>
    </Screen>
  );
}

function TeamBody({ team, teams }: { team: SkTeam; teams: SkTeam[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const roster = useSkRoster(team.id);
  const games = useSkTeamGames(team.id);
  const teamPAs = useSkTeamPAs(team.id);
  const allRuns = useSkAllInningRuns(team.id);

  const [starting, setStarting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const active = (roster ?? []).filter((p) => p.archivedAt === null);
  const archived = (roster ?? []).filter((p) => p.archivedAt !== null);

  const teamLine = useMemo(() => computeLine((teamPAs ?? []).map((r) => r.outcome)), [teamPAs]);
  const byPlayer = useMemo(() => groupOutcomesByPlayer(teamPAs ?? []), [teamPAs]);

  const endedGames = useMemo(() => (games ?? []).filter((g) => g.endedAt !== null), [games]);
  const record = useMemo(() => {
    const totals = new Map<string, { us: number; them: number }>();
    for (const game of endedGames) totals.set(game.id, { us: 0, them: 0 });
    for (const row of allRuns ?? []) {
      const t = totals.get(row.gameId);
      if (!t) continue; // open game — not on the record yet
      t.us += row.runsUs;
      t.them += row.runsThem;
    }
    let w = 0;
    let l = 0;
    let ties = 0;
    for (const t of totals.values()) {
      const r = gameResult(t.us, t.them);
      if (r === 'W') w += 1;
      else if (r === 'L') l += 1;
      else ties += 1;
    }
    return ties > 0 ? `${w}-${l}-${ties}` : `${w}-${l}`;
  }, [endedGames, allRuns]);

  const openGame = games?.find((g) => g.endedAt === null);
  const canStart = openGame !== undefined || active.length > 0;

  const onPrimary = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Ask the DB directly instead of trusting render state (same guard
      // as the player-mode Dashboard) so a double tap can't double-start.
      const game = (await getOpenSkGame(team.id)) ?? (await startSkGame(team.id));
      router.push({ pathname: '/sk-game/[id]', params: { id: game.id } });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Scorekeeper</Eyebrow>
          <Display size={32} numberOfLines={1}>
            {team.name}
          </Display>
        </View>
        <SwitchToPlayerButton />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.l, paddingBottom: spacing.l }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {teams.length > 1 && (
          <Chips
            options={teams.map((t) => ({ key: t.id, label: t.name }))}
            value={team.id}
            onChange={(id) => void setActiveSkTeam(id)}
          />
        )}

        <ScoreboardPanel title="Team season">
          <View style={{ gap: spacing.l }}>
            <ScoreStatRow>
              <ScoreStat label="AVG" value={formatAvg(teamLine.avg)} size={36} />
              <ScoreStat label="OBP" value={formatAvg(teamLine.obp)} size={36} />
            </ScoreStatRow>
            <ScoreStatRow>
              <ScoreStat label="SLG" value={formatAvg(teamLine.slg)} size={36} />
              <ScoreStat label="OPS" value={formatAvg(teamLine.ops)} size={36} />
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
            <MiniStat label="G" value={String(endedGames.length)} />
            <MiniStat label="REC" value={record} />
            <MiniStat label="PA" value={String(teamLine.pa)} />
            <MiniStat label="H" value={String(teamLine.h)} />
            <MiniStat label="HR" value={String(teamLine.hr)} />
          </View>
        </ScoreboardPanel>

        {active.length > 0 && (
          <View style={{ gap: spacing.s }}>
            <Eyebrow>Batters</Eyebrow>
            <View style={{ gap: spacing.s }}>
              {active.map((player) => (
                <PlayerStatRow
                  key={player.id}
                  player={player}
                  outcomes={byPlayer.get(player.id) ?? []}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: spacing.s }}>
          <DisclosureHeader
            label="Edit roster"
            open={editOpen}
            onToggle={() => setEditOpen((v) => !v)}
          />
          {editOpen && <RosterEditor team={team} active={active} />}
        </View>

        {archived.length > 0 && (
          <View style={{ gap: spacing.s }}>
            <DisclosureHeader
              label={`Archived (${archived.length})`}
              open={archivedOpen}
              onToggle={() => setArchivedOpen((v) => !v)}
            />
            {archivedOpen &&
              archived.map((player) => (
                <View
                  key={player.id}
                  style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}
                >
                  <Body style={{ flex: 1 }} color={colors.textSoft}>
                    {player.name}
                  </Body>
                  <Mono size={13} color={colors.textSoft}>
                    {statLineLabel(byPlayer.get(player.id) ?? [])}
                  </Mono>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${player.name} to the roster`}
                    hitSlop={8}
                    onPress={() => void unarchiveRosterPlayer(player.id)}
                  >
                    <MaterialCommunityIcons name="restore" size={20} color={colors.textSoft} />
                  </Pressable>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingBottom: spacing.l, gap: spacing.s }}>
        {!canStart && (
          <Body size={13} color={colors.textSoft} style={{ textAlign: 'center' }}>
            Add at least one player to start a game.
          </Body>
        )}
        <BigButton
          label={openGame ? 'Resume game' : 'Start game'}
          onPress={() => void onPrimary()}
          disabled={starting || games === undefined || !canStart}
        />
      </View>
    </Screen>
  );
}

function statLineLabel(outcomes: OutcomeCode[]): string {
  const line = computeLine(outcomes);
  if (line.pa === 0) return '—';
  return `${line.h}-${line.ab} · ${formatAvg(line.avg)}`;
}

function PlayerStatRow({ player, outcomes }: { player: SkPlayer; outcomes: OutcomeCode[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
      {player.number !== null && (
        <Mono size={13} color={colors.textSoft}>
          #{player.number}
        </Mono>
      )}
      <Body style={{ flex: 1 }}>{player.name}</Body>
      <Mono size={14}>{statLineLabel(outcomes)}</Mono>
    </View>
  );
}

function DisclosureHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={styles.disclosure}
      hitSlop={8}
    >
      <Eyebrow>{label}</Eyebrow>
      <MaterialCommunityIcons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={colors.textSoft}
      />
    </Pressable>
  );
}

/** Roster surgery: rename team, edit/reorder/remove players, add new ones. */
function RosterEditor({ team, active }: { team: SkTeam; active: SkPlayer[] }) {
  const { colors } = useTheme();
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const onAdd = async () => {
    if (!newName.trim()) return;
    await addRosterPlayer(team.id, newName, newNumber);
    setNewName('');
    setNewNumber('');
  };

  const onRemove = (player: SkPlayer) => {
    Alert.alert(`Remove ${player.name}?`, 'A player with recorded at-bats is archived instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeRosterPlayer(player.id).then((result) => {
            if (result === 'archived') {
              Alert.alert(
                'Archived',
                `${player.name} has at-bats on the books, so they moved to Archived instead of being deleted.`,
              );
            }
          });
        },
      },
    ]);
  };

  return (
    <View style={{ gap: spacing.s }}>
      <TextInput
        defaultValue={team.name}
        onEndEditing={(e) => void renameSkTeam(team.id, e.nativeEvent.text)}
        placeholder="Team name"
        placeholderTextColor={colors.textSoft}
        style={[
          styles.input,
          { borderColor: colors.line, color: colors.text, backgroundColor: colors.card },
        ]}
        returnKeyType="done"
      />

      {active.map((player, index) => (
        <View
          key={player.id}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}
        >
          <TextInput
            defaultValue={player.name}
            onEndEditing={(e) => void updateRosterPlayer(player.id, { name: e.nativeEvent.text })}
            placeholder="Name"
            placeholderTextColor={colors.textSoft}
            style={[styles.rowInput, { color: colors.text, flex: 1 }]}
          />
          <TextInput
            defaultValue={player.number ?? ''}
            onEndEditing={(e) => void updateRosterPlayer(player.id, { number: e.nativeEvent.text })}
            placeholder="##"
            placeholderTextColor={colors.textSoft}
            keyboardType="number-pad"
            maxLength={3}
            style={[styles.rowInput, { color: colors.textSoft, width: 44, textAlign: 'center' }]}
          />
          <IconButton
            name="chevron-up"
            label={`Move ${player.name} up`}
            disabled={index === 0}
            onPress={() => void moveRosterPlayer(team.id, player.id, -1)}
          />
          <IconButton
            name="chevron-down"
            label={`Move ${player.name} down`}
            disabled={index === active.length - 1}
            onPress={() => void moveRosterPlayer(team.id, player.id, 1)}
          />
          <IconButton
            name="close"
            label={`Remove ${player.name}`}
            onPress={() => onRemove(player)}
          />
        </View>
      ))}

      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Add player"
          placeholderTextColor={colors.textSoft}
          style={[styles.rowInput, { color: colors.text, flex: 1 }]}
          returnKeyType="done"
          onSubmitEditing={() => void onAdd()}
        />
        <TextInput
          value={newNumber}
          onChangeText={setNewNumber}
          placeholder="##"
          placeholderTextColor={colors.textSoft}
          keyboardType="number-pad"
          maxLength={3}
          style={[styles.rowInput, { color: colors.textSoft, width: 44, textAlign: 'center' }]}
        />
        <IconButton name="plus-circle-outline" label="Add player" onPress={() => void onAdd()} />
      </View>

      {teamFormOpen ? (
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <TextInput
            value={newTeamName}
            onChangeText={setNewTeamName}
            placeholder="New team name"
            placeholderTextColor={colors.textSoft}
            style={[styles.rowInput, { color: colors.text, flex: 1 }]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (newTeamName.trim()) void createSkTeam(newTeamName);
            }}
          />
          <IconButton
            name="check"
            label="Create team"
            onPress={() => {
              if (newTeamName.trim()) void createSkTeam(newTeamName);
            }}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setTeamFormOpen(true)}
          style={{ paddingVertical: spacing.s }}
        >
          <Body size={14} color={colors.textSoft}>
            + New team
          </Body>
        </Pressable>
      )}
    </View>
  );
}

function IconButton({
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

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Eyebrow size={10} color={colors.panelTextSoft}>
        {label}
      </Eyebrow>
      <Mono size={15} color={colors.panelText}>
        {value}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
    gap: spacing.m,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    borderRadius: radius.m,
    borderWidth: 1,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    minHeight: 48,
  },
  rowInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: spacing.xs,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
