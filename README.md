# ⚾ BattersBox

A dead-simple baseball & softball hitting tracker. Tap the outcome of each
at-bat — the app keeps your running AVG / OBP / SLG / OPS across games and
seasons. Fully offline: everything lives in a local SQLite database on the
phone. No account, no cloud, no signal needed in the bleachers.

**v1 = Player Mode only** (one player, your own log). The schema is
future-proofed for Scorekeeper Mode: a `players` table exists from day one and
plate appearances reserve spray-chart coordinates.

## Stack

| Layer | Choice |
|---|---|
| Framework | React Native + **Expo SDK 54** (Expo Router, TypeScript strict) — pinned to 54 because the user's iPhone runs the last Expo Go its iOS version supports |
| Database | **expo-sqlite + Drizzle ORM** — typed schema, versioned migrations, `useLiveQuery` reactivity |
| State | DB is the source of truth; Zustand only for the undo toast |
| Charts | react-native-svg, hand-rolled (palette validated for CVD + contrast in both themes) |
| Tests | Vitest on the pure-TS stats engine (`src/domain`) |

## Requirements

- **Node ≥ 20.19 (Node 22 LTS installed via nvm — `nvm use 22.23.1`)**.
  React Native 0.86 refuses older Nodes.
- npm (comes with Node)
- For iPhone testing: the free **Expo Go** app from the App Store

## Run it

```powershell
cd C:\Users\Tai Meade\PersonalDevelopment\battersbox
npm install
npx expo start
```

### Test on your iPhone (no Mac, no Apple Developer account)

1. Install **Expo Go** from the App Store on the iPhone.
2. Make sure the iPhone and this PC are on the **same Wi-Fi network**.
3. Run `npx expo start` in the project folder.
4. Open the iPhone **Camera** app and scan the QR code in the terminal —
   tap the banner and it opens in Expo Go.
5. Changes hot-reload as you save files.

> Firewall note: the first run may pop a Windows Defender prompt for Node —
> allow it on **private networks**, or the phone can't reach Metro.
> If the connection still fails (some routers isolate devices), run
> `npx expo start --tunnel` instead — it routes over the internet and always works.

### Test on Android

Same flow with Expo Go from the Play Store, or press `a` in the Metro terminal
if an emulator is running.

## Scripts

```powershell
npm test            # stats-engine golden tests (vitest)
npm run typecheck   # tsc --noEmit
npm run db:generate # regenerate drizzle migrations after editing src/db/schema.ts
```

## Project layout

```
src/
  app/                  # Expo Router screens
    (tabs)/             # Dashboard · Games · Trends · Settings
    game/[id]/          # live logging screen + game summary
    onboarding.tsx      # first-run: sport, season, name
  db/                   # Drizzle schema, client, repositories
  domain/               # outcome taxonomy + stats engine (pure TS, tested)
  components/           # design system (Scoreboard & Chalk)
  theme/                # tokens: palette, type, per-theme colors
  hooks/ lib/ store/
drizzle/                # generated SQL migrations (bundled into the app)
```

## Design system — "Scoreboard & Chalk"

- The **scoreboard panel** (monster green + amber mono numerals) is the
  signature; it stays green in light *and* dark mode.
- Light mode is foul-line chalk (paper beats glass in sunlight — the tap
  surfaces stay light with dark text); dark mode is deep night-green.
- Outcome tiles are grouped by scoring meaning: **Hits** (grass) ·
  **On base** (amber) · **Outs** (clay) · **Sacrifice** (bunting blue).
  Long-press FC / E / SF / SAC tiles for plain-language scoring rules.
- Type: Barlow Condensed (display) · Barlow (body) · IBM Plex Mono (all stat
  numerals, tabular).

## Scoring defaults baked in

- FC and reached-on-error: at-bat, no hit, no OBP credit (official scoring).
- Sac **fly** counts against OBP; sac **bunt** doesn't.
- Zero denominators render as `—`, never NaN.

## Shipping to TestFlight later (still no Mac needed)

1. Create a free account at expo.dev, then `npm i -g eas-cli && eas login`.
2. `eas build:configure`
3. Enroll in the Apple Developer Program ($99/yr — takes a few days).
4. `eas build --platform ios --profile production` (cloud build, EAS manages
   certificates) then `eas submit -p ios`.

## Not in v1 (deliberately)

Spray chart (schema ready: `spray_x/y`) → Pro paywall → Scorekeeper Mode
(lineups/innings around the same PA table) → optional cloud sync. Custom app
icon/splash still TODO before any store submission.
