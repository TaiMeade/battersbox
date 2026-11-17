import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import migrations from '../../drizzle/migrations';
import { db, prepareDatabase } from '@/db/client';
import { registerOfflineSupport } from '@/lib/offline';
import { installWebAlert } from '@/lib/webAlert';
import { firstSync, startSync, syncEnabled } from '@/sync/client';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();
installWebAlert();
registerOfflineSupport();

/** The database must be ready before any screen (or the migrator) touches it. */
export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  useEffect(() => {
    prepareDatabase(() => setOtherTab(true)).then(() => setDbReady(true), setDbError);
  }, []);
  if (dbError) return <DatabaseError message={dbError.message} />;
  if (!dbReady && otherTab) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ textAlign: 'center' }}>
          BattersBox is open in another tab or window.{'\n'}Close it and this one will open.
        </Text>
      </View>
    );
  }
  if (!dbReady) return null; // splash screen stays up
  return <ReadyLayout />;
}

function DatabaseError({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ textAlign: 'center' }}>
        BattersBox couldn&apos;t open its database.{'\n'}Restart the app to try again.
        {'\n\n'}
        {message}
      </Text>
    </View>
  );
}

function ReadyLayout() {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);

  // Web: on a new device, bring down what's on the server before first-run
  // setup decides there's nothing here; then keep syncing.
  const [firstSyncDone, setFirstSyncDone] = useState(!syncEnabled);
  useEffect(() => {
    if (!migrated || !syncEnabled) return;
    void firstSync(6000).finally(() => {
      setFirstSyncDone(true);
      startSync();
    });
  }, [migrated]);

  const ready = fontsLoaded && migrated && firstSyncDone;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Should never happen in the field; if it does, don't fail silently.
  if (migrationError) return <DatabaseError message={migrationError.message} />;

  if (!ready) return null; // splash screen stays up

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(sk)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="card" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
