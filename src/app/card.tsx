import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { BigButton } from '@/components/BigButton';
import {
  CARD_RATIO,
  CardBack,
  CardFront,
  type CardIdentity,
  type CardStatRow,
} from '@/components/card/BaseballCard';
import { Screen } from '@/components/Screen';
import { Body, Display, Eyebrow } from '@/components/typography';
import { db } from '@/db/client';
import { players } from '@/db/schema';
import { cardTrivia } from '@/domain/cardFacts';
import { computeLine } from '@/domain/stats';
import { useCardProfile, useCardStats } from '@/hooks/useCardData';
import { useActiveSeason } from '@/hooks/useSeasonData';
import {
  removeCardPhoto,
  saveCardPhoto,
  setCardDetail,
  type CardDetailKey,
} from '@/lib/cardProfile';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Side = 'front' | 'back';

/** Shares always render at the same width so every export looks identical. */
const CAPTURE_W = 330;

/** iOS number pad has no return key — this accessory bar supplies the Done. */
const NUMBER_ACCESSORY_ID = 'card-number-done';

export default function CardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - spacing.l * 2, 330);
  const cardH = Math.round(cardW * CARD_RATIO);

  const { season } = useActiveSeason();
  const profile = useCardProfile();
  const stats = useCardStats();
  const { data: playerRows } = useLiveQuery(db.select().from(players).limit(1));
  const playerName = playerRows?.[0]?.name.trim() || 'Me';

  // Detail drafts hydrate once from the DB, then the inputs own them.
  const [team, setTeam] = useState('');
  const [position, setPosition] = useState('');
  const [number, setNumber] = useState('');
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile.loading && !hydrated.current) {
      hydrated.current = true;
      setTeam(profile.team);
      setPosition(profile.position);
      setNumber(profile.number);
    }
  }, [profile]);

  const [side, setSide] = useState<Side>('front');
  const flip = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  const turnOver = () => {
    const next: Side = side === 'front' ? 'back' : 'front';
    setSide(next);
    Animated.timing(flip, {
      toValue: next === 'back' ? 1 : 0,
      duration: reduceMotion ? 0 : 480,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const year = useMemo(() => {
    const latest = stats?.gameFacts[stats.gameFacts.length - 1];
    return latest?.playedOn.slice(0, 4) || String(new Date().getFullYear());
  }, [stats]);

  const identity: CardIdentity = {
    name: playerName,
    team: team.trim() || season?.name || `${year} Season`,
    position: position.trim(),
    number: number.trim(),
    year,
  };

  const rows = useMemo<CardStatRow[]>(
    () =>
      (stats?.seasonLines ?? []).map((s) => ({
        label: s.name,
        games: s.games,
        line: computeLine(s.outcomes),
      })),
    [stats],
  );
  const career = useMemo(
    () => computeLine((stats?.seasonLines ?? []).flatMap((s) => s.outcomes)),
    [stats],
  );
  const careerGames = (stats?.seasonLines ?? []).reduce((n, s) => n + s.games, 0);
  const trivia = useMemo(() => cardTrivia(stats?.gameFacts ?? []), [stats]);

  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || result.assets.length === 0) return;
    await saveCardPhoto(result.assets[0].uri);
  };

  const onPhoto = () => {
    if (!profile.photoUri) {
      void pickPhoto();
      return;
    }
    Alert.alert('Card photo', undefined, [
      { text: 'Choose a new photo', onPress: () => void pickPhoto() },
      { text: 'Remove photo', style: 'destructive', onPress: () => void removeCardPhoto() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shotRef = useRef<View>(null);
  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const shot = await captureRef(shotRef, { format: 'png', quality: 1 });
      const file = new File(Paths.cache, `battersbox-card-${side}.png`);
      if (file.exists) file.delete();
      new File(shot).copy(file);
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'BattersBox card' });
    } catch (e) {
      Alert.alert('Couldn’t share the card', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDetail = (key: CardDetailKey, value: string) => void setCardDetail(key, value);

  const loading = profile.loading || stats === undefined;

  return (
    <Screen>
      <View style={styles.header}>
        <Display size={30}>Baseball card</Display>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="close" size={26} color={colors.textSoft} />
        </Pressable>
      </View>

      {loading ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.l, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={{ alignItems: 'center', gap: spacing.m }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                side === 'front' ? 'Turn the card over' : 'Turn the card back to the front'
              }
              onPress={turnOver}
            >
              <View style={{ width: cardW, height: cardH }}>
                <Animated.View
                  style={[
                    styles.cardFace,
                    { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
                  ]}
                >
                  <CardFront width={cardW} identity={identity} photoUri={profile.photoUri} />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.cardFace,
                    { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
                  ]}
                >
                  <CardBack
                    width={cardW}
                    identity={identity}
                    rows={rows}
                    career={career}
                    careerGames={careerGames}
                    trivia={trivia}
                  />
                </Animated.View>
              </View>
            </Pressable>
            <Body size={13} color={colors.textSoft}>
              Tap the card to turn it over.
            </Body>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.m }}>
            <BigButton
              label={profile.photoUri ? 'Change photo' : 'Add photo'}
              variant="secondary"
              onPress={onPhoto}
              style={{ flex: 1 }}
            />
            <BigButton
              label={side === 'front' ? 'Share front' : 'Share back'}
              onPress={() => void onShare()}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ gap: spacing.m }}>
            <Eyebrow>Card details</Eyebrow>
            <View style={{ flexDirection: 'row', gap: spacing.m }}>
              <DetailInput
                flex={2}
                placeholder="Team"
                value={team}
                onChangeText={setTeam}
                onDone={() => saveDetail('team', team)}
              />
              <DetailInput
                flex={1}
                placeholder="POS"
                autoCapitalize="characters"
                maxLength={6}
                value={position}
                onChangeText={setPosition}
                onDone={() => saveDetail('position', position)}
              />
              <DetailInput
                flex={1}
                placeholder="No."
                keyboardType="number-pad"
                maxLength={3}
                inputAccessoryViewID={Platform.OS === 'ios' ? NUMBER_ACCESSORY_ID : undefined}
                value={number}
                onChangeText={setNumber}
                onDone={() => saveDetail('number', number)}
              />
            </View>
            <Body size={13} color={colors.textSoft}>
              The name comes from Settings → Player. Stats print themselves from your at-bats.
            </Body>
          </View>
        </ScrollView>
      )}

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NUMBER_ACCESSORY_ID}>
          <View
            style={[styles.accessory, { backgroundColor: colors.card, borderTopColor: colors.line }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done entering the jersey number"
              hitSlop={10}
              onPress={() => Keyboard.dismiss()}
            >
              <Body size={16} color={colors.text} style={{ fontFamily: fonts.bodySemiBold }}>
                Done
              </Body>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* Off-screen copy of the visible side: shares capture this, never the mid-flip view. */}
      {!loading && (
        <View ref={shotRef} collapsable={false} pointerEvents="none" style={styles.shot}>
          {side === 'front' ? (
            <CardFront width={CAPTURE_W} identity={identity} photoUri={profile.photoUri} />
          ) : (
            <CardBack
              width={CAPTURE_W}
              identity={identity}
              rows={rows}
              career={career}
              careerGames={careerGames}
              trivia={trivia}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function DetailInput({
  flex,
  onDone,
  ...rest
}: TextInputProps & { flex: number; onDone: () => void }) {
  const { colors } = useTheme();
  return (
    <TextInput
      {...rest}
      onEndEditing={onDone}
      placeholderTextColor={colors.textSoft}
      style={[
        styles.input,
        { flex, borderColor: colors.line, color: colors.text, backgroundColor: colors.card },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  shot: {
    position: 'absolute',
    top: 0,
    left: -9999,
    width: CAPTURE_W,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
