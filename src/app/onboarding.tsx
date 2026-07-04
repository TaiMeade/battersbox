import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { Body, Eyebrow } from '@/components/typography';
import { createSeason, ensurePlayer, renamePlayer } from '@/db/repo';
import type { Sport } from '@/db/schema';
import { defaultSeasonName } from '@/lib/format';
import { fonts, palette, radius, spacing } from '@/theme/tokens';

/**
 * First run: the scoreboard takes over the whole screen.
 * One screen, one required choice (sport), under 15 seconds to first PA.
 */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sport, setSport] = useState<Sport>('baseball');
  const [seasonName, setSeasonName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [saving, setSaving] = useState(false);

  const start = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await ensurePlayer(playerName.trim() || 'Me');
      if (playerName.trim()) await renamePlayer(playerName);
      await createSeason(seasonName.trim() || defaultSeasonName(), sport);
      router.replace('/');
    } catch (e) {
      Alert.alert(
        'Couldn’t start your season',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxl }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.s }}>
            <Eyebrow color={palette.monsterTextSoft}>Welcome to the</Eyebrow>
            <Text style={styles.title}>Batter&apos;s Box</Text>
            <Body color={palette.monsterTextSoft} size={16}>
              Your batting line, one tap per at-bat. Everything stays on this phone.
            </Body>
          </View>

          <View style={{ gap: spacing.s }}>
            <Eyebrow color={palette.monsterTextSoft}>Your game</Eyebrow>
            <View style={{ flexDirection: 'row', gap: spacing.m }}>
              <SportTile
                emoji="⚾"
                label="Baseball"
                selected={sport === 'baseball'}
                onPress={() => setSport('baseball')}
              />
              <SportTile
                emoji="🥎"
                label="Softball"
                selected={sport === 'softball'}
                onPress={() => setSport('softball')}
              />
            </View>
          </View>

          <View style={{ gap: spacing.s }}>
            <Eyebrow color={palette.monsterTextSoft}>Season name</Eyebrow>
            <TextInput
              value={seasonName}
              onChangeText={setSeasonName}
              placeholder={defaultSeasonName()}
              placeholderTextColor={palette.monsterTextSoft}
              style={styles.input}
              returnKeyType="next"
            />
          </View>

          <View style={{ gap: spacing.s }}>
            <Eyebrow color={palette.monsterTextSoft}>Your name (optional)</Eyebrow>
            <TextInput
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Me"
              placeholderTextColor={palette.monsterTextSoft}
              style={styles.input}
              returnKeyType="done"
            />
          </View>

          <BigButton label="Play ball" onPress={() => void start()} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SportTile({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.sportTile,
        {
          backgroundColor: selected ? palette.bulb : 'transparent',
          borderColor: selected ? palette.bulb : palette.monsterEdge,
        },
      ]}
    >
      <Text style={{ fontSize: 34 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: fonts.displayBold,
          fontSize: 18,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: selected ? palette.ink : palette.chalk,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.monster,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 52,
    lineHeight: 56,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: palette.chalk,
  },
  input: {
    borderWidth: 2,
    borderColor: palette.monsterEdge,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    color: palette.chalk,
  },
  sportTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s,
    borderWidth: 2,
    borderRadius: radius.l,
    paddingVertical: spacing.l,
  },
});
