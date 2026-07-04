import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { Body, Display, Eyebrow } from '@/components/typography';
import {
  createSeason,
  deleteSeason,
  ensurePlayer,
  renamePlayer,
  renameSeason,
  setActiveSeason,
  setSeasonSport,
} from '@/db/repo';
import type { Season, Sport } from '@/db/schema';
import { exportBackup, exportSeasonCSV, restoreBackup } from '@/lib/exportData';
import { defaultSeasonName } from '@/lib/format';
import { useActiveSeason, useSeasons } from '@/hooks/useSeasonData';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '@/db/client';
import { players } from '@/db/schema';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SPORT_OPTIONS: { key: Sport; label: string }[] = [
  { key: 'baseball', label: '⚾ Baseball' },
  { key: 'softball', label: '🥎 Softball' },
];

export default function Settings() {
  const { colors } = useTheme();
  const { season: activeSeason } = useActiveSeason();
  const seasons = useSeasons();
  const { data: playerRows } = useLiveQuery(db.select().from(players).limit(1));
  const player = playerRows?.[0];

  const [name, setName] = useState('');
  useEffect(() => {
    if (player) setName(player.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onExportCSV = () => {
    if (!activeSeason) return;
    void run(() => exportSeasonCSV(activeSeason));
  };

  const onBackup = () => void run(() => exportBackup());

  const onRestore = () => {
    Alert.alert(
      'Restore from backup?',
      'This replaces everything currently in the app with the backup file’s contents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              const result = await restoreBackup();
              if (result === 'restored') {
                Alert.alert('Restored', 'Your stats are back.');
              } else if (result === 'invalid') {
                Alert.alert(
                  'Not a BattersBox backup',
                  'Pick a .json file exported from Settings → Back up everything.',
                );
              }
            }),
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ paddingVertical: spacing.s }}>
        <Display size={32}>Settings</Display>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Player">
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => {
              void (async () => {
                await ensurePlayer();
                await renamePlayer(name);
              })();
            }}
            placeholder="Me"
            placeholderTextColor={colors.textSoft}
            style={[
              styles.input,
              { borderColor: colors.line, color: colors.text, backgroundColor: colors.card },
            ]}
          />
        </Section>

        {activeSeason && (
          <Section title="Active season sport">
            <Chips<Sport>
              options={SPORT_OPTIONS}
              value={activeSeason.sport}
              onChange={(sport) => void setSeasonSport(activeSeason.id, sport)}
            />
          </Section>
        )}

        <Section title="Seasons">
          <View style={{ gap: spacing.s }}>
            {seasons.map((season) => (
              <SeasonRow key={season.id} season={season} onlySeason={seasons.length === 1} />
            ))}
          </View>
          <NewSeasonForm />
        </Section>

        <Section title="Your data">
          <DataRow
            icon="table-arrow-right"
            label="Export season CSV"
            description={
              activeSeason ? `Every at-bat in ${activeSeason.name}` : 'No active season'
            }
            disabled={!activeSeason || busy}
            onPress={onExportCSV}
          />
          <DataRow
            icon="content-save-outline"
            label="Back up everything"
            description="One file with all seasons, games, and at-bats"
            disabled={busy}
            onPress={onBackup}
          />
          <DataRow
            icon="backup-restore"
            label="Restore from backup"
            description="Replaces current data with a backup file"
            disabled={busy}
            onPress={onRestore}
          />
        </Section>

        <Section title="About">
          <Body color={colors.textSoft} style={{ lineHeight: 21 }}>
            BattersBox {Constants.expoConfig?.version ?? ''} — all data lives on this phone. No
            account, no cloud, no signal needed in the bleachers.
          </Body>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.m }}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

function SeasonRow({ season, onlySeason }: { season: Season; onlySeason: boolean }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(season.name);

  const saveName = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== season.name) void renameSeason(season.id, draft);
  };

  const onDelete = () => {
    Alert.alert(
      `Delete ${season.name}?`,
      'Every game and at-bat in this season goes with it. This can’t be undone.',
      [
        { text: 'Keep season', style: 'cancel' },
        {
          text: 'Delete season',
          style: 'destructive',
          onPress: () => void deleteSeason(season.id),
        },
      ],
    );
  };

  if (editing) {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.panel, borderWidth: 2 },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={saveName}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          placeholder={season.name}
          placeholderTextColor={colors.textSoft}
          style={{
            flex: 1,
            fontFamily: fonts.bodySemiBold,
            fontSize: 16,
            color: colors.text,
            padding: 0,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save season name"
          onPress={saveName}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="check" size={22} color={colors.group.hit.fg} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel rename"
          onPress={() => {
            setDraft(season.name);
            setEditing(false);
          }}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close" size={22} color={colors.textSoft} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: season.isActive }}
      onPress={() => void setActiveSeason(season.id)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.line : colors.card,
          borderColor: season.isActive ? colors.panel : colors.line,
          borderWidth: season.isActive ? 2 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={season.isActive ? 'radiobox-marked' : 'radiobox-blank'}
        size={20}
        color={season.isActive ? colors.group.hit.fg : colors.textSoft}
      />
      <View style={{ flex: 1 }}>
        <Body size={16} style={{ fontFamily: fonts.bodySemiBold }}>
          {season.name}
        </Body>
        <Body size={13} color={colors.textSoft}>
          {season.sport === 'softball' ? 'Softball' : 'Baseball'}
          {season.isActive ? ' · active' : ''}
        </Body>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rename ${season.name}`}
        onPress={() => {
          setDraft(season.name);
          setEditing(true);
        }}
        hitSlop={10}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textSoft} />
      </Pressable>
      {!onlySeason && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${season.name}`}
          onPress={onDelete}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
        </Pressable>
      )}
    </Pressable>
  );
}

function NewSeasonForm() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('baseball');

  if (!open) {
    return (
      <BigButton label="New season" variant="secondary" onPress={() => setOpen(true)} />
    );
  }

  const create = async () => {
    await createSeason(name.trim() || defaultSeasonName(), sport);
    setName('');
    setOpen(false);
  };

  return (
    <View
      style={{
        gap: spacing.m,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.m,
        padding: spacing.l,
        backgroundColor: colors.card,
      }}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={defaultSeasonName()}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { borderColor: colors.line, color: colors.text }]}
        autoFocus
      />
      <Chips<Sport> options={SPORT_OPTIONS} value={sport} onChange={setSport} />
      <View style={{ flexDirection: 'row', gap: spacing.m }}>
        <BigButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <BigButton label="Create" onPress={() => void create()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function DataRow({
  icon,
  label,
  description,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.line : colors.card,
          borderColor: colors.line,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Body size={16} style={{ fontFamily: fonts.bodySemiBold }}>
          {label}
        </Body>
        <Body size={13} color={colors.textSoft}>
          {description}
        </Body>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
});
