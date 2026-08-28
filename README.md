# DEADRUN

A GPS chase game. It spawns a horde on the real streets around wherever you are
standing, they walk toward your actual position, and the only control is your
legs. Every 45 seconds more arrive and the whole horde gets faster. You do not
win — you last longer than last time.

Built with Expo (React Native) and targeted at Google Play.

---

## How the game works

| | |
|---|---|
| **Spawning** | Wave 1 drops 3 zombies 110–175 m away on random bearings. Each wave adds more and raises horde speed. |
| **Ambushes** | From wave 3 a third of each wave spawns *in the direction you are already running*, so sprinting in a straight line stops working. |
| **Pursuit** | Zombies walk toward your last GPS fix. From wave 4 they lead the target, cutting the corner you are about to turn. |
| **Kinds** | `walker` (slow, forever), `runner` (fast, loses interest after 70 s), `brute` (slow, 20 m reach). |
| **Getting caught** | A zombie within its reach costs a life and shoves the rest back 45 m. Out of lives, run over. |
| **Supply drops** | Land 70–140 m away in the direction with the fewest zombies. Medkit (+1 life), adrenaline (horde at 42% speed for 14 s), flare (burns everything within 70 m). Detouring for these is the actual game. |
| **Scoring** | seconds + metres + kills + supplies + waves, multiplied by difficulty. |
| **Anti-cheat** | Sustained movement over 9 m/s (32 km/h) for 12 s voids the run. Zombies do not chase cars. |

Difficulty and every tuning constant live in [`src/config.ts`](src/config.ts).

---

## Setup

You need Node 20+ and an Android phone. No Expo account, no Google Cloud
project, no API key, no card on file.

```bash
npm install
```

> **Windows: keep a space out of the project path.** Metro cannot resolve modules
> from a directory whose path contains a space — `expo export` and `expo start`
> both fail with `Unable to resolve module ./index.ts`. This folder is
> `Zombie-run`, not `Zombie run`, for exactly that reason. Non-ASCII characters
> in the path (like `Masaüstü`) are fine.

### 1. Run it on your phone

Every native module the game uses ships inside Expo Go, so there is nothing to
build before you can play:

```bash
npm start
```

Scan the QR code with [Expo Go](https://expo.dev/go). Grant location, walk
outside, and the horde lands on your street. JavaScript changes reload instantly.

For a standalone `.apk` that runs without Expo Go, see
[Building the APK](#building-the-apk).

### 2. The map

The basemap is [CARTO](https://carto.com/basemaps)'s dark raster tiles rendered
from OpenStreetMap data, drawn tile by tile in
[`src/components/MapCanvas.tsx`](src/components/MapCanvas.tsx) on top of the
Web Mercator maths in [`src/tiles.ts`](src/tiles.ts).

There is no `react-native-maps` and no Google Cloud. Google's Maps SDK is free
for unlimited native Android map loads, but it will not issue a key at all until
a **credit card** is on file, and an unrestricted key that leaks can be spent
against the Maps APIs that *do* bill. That was the cost — a card and a Cloud
project — for a hobby game whose map is a dark backdrop with dots on it.

### The camera

The camera does **not** ride on your shoulder. You get a box in the middle of the
screen — 16% of the width, 12% of the height — to move around in, and only when
you reach its edge does the map start sliding to keep up.

This matters more than it sounds. A camera locked to the player pins the arrow to
the exact centre of the screen for ever, so a perfect GPS fix and a completely
dead one look **identical**: in both cases the arrow sits still. Letting yourself
travel across the map makes your own movement the most obvious thing on screen,
and it is the fastest way to see that tracking is alive. Course-up is the
exception — it spins the world about the middle of the screen, so there you stay
centred, or the rotation would swing you around it.

`followCamera` in [`src/tiles.ts`](src/tiles.ts) is pure, and `npm run check:tiles`
walks a simulated 3 m/s runner 540 m to assert the arrow really does travel, never
leaves the screen, and does not creep when you stand still.

### Which way you are looking

Two different things can tell you where the phone is pointed, and the game needs
both:

| | |
|---|---|
| **GPS course** | Where you are *going*. Accurate while running, meaningless standing still, and absent below about 1.4 m/s. |
| **Compass** | Where you are *facing*. Always available, noisier. |

`facingDeg` in [`src/geo.ts`](src/geo.ts) picks between them: GPS course above a
jog, magnetometer below it.

The subtlety that matters is *when* the compass is read. A position fix only
arrives when you **move** — `watchPositionAsync` is set to a 1 m distance
interval — so anything that reads heading off the fix freezes solid the moment
you stand still and turn on the spot. That silently froze the player arrow, the
whole radar (its contacts are plotted relative to your heading) and both
direction arrows in the dock. The compass therefore publishes its own updates
from the tracker, throttled to 2°, and `facing` is passed down as a prop rather
than read out of game state.

The map also draws a translucent **wedge** ahead of you, because a 34 dp arrow is
easy to misread at a glance while running.

### The CARTO key

CARTO gives basemap keys away: [one form](https://carto.com/basemaps/apikey),
emailed straight back, **no account, no credit card, no approval queue**, 5
million tiles a month free. A single run of DEADRUN uses a few hundred.

```bash
cp .env.example .env      # then paste the key in
npm run apk
```

**Without a key the game plays identically, but every tile arrives with "API KEY
REQUIRED" stamped diagonally across it** — CARTO bakes it into the raster. The
map is still perfectly readable and nothing else changes, but it looks like a
demo. Getting the key takes about a minute.

Attribution to OpenStreetMap and CARTO is drawn in the corner of the map. Both
licences require it; leave it there.

If tiles fail to load — no signal, dead zone — the map falls back to a dark
grid and **the game keeps working**. Zombie positions, distance and scoring are
computed from GPS, not from the map, so a blank map costs you navigation, not
the run.

```bash
npm run check:tiles
```

verifies the projection against the live tile server: four landmarks on four
continents have to land on the tile the standard slippy-map formula picks, 100 m
north has to come out as 100 m of pixels upward, and a downtown tile has to
carry more detail than open ocean.

---

## Testing without leaving the house

The engine is pure — no React, no GPS — so whole matches can be replayed from a
seed. The balance harness runs a simulated runner against the horde:

```bash
npm run sim
```

Current balance, averaged over 5 seeds per profile:

```
profile          waves   time     dist     score    supplies  end
statue            3.6    2m16       0m     2096       0.0  caught=5
walker 1.4m/s     5.0    3m18     273m     3593       0.2  caught=5
jogger 2.5m/s     6.2    4m21     650m     5267       0.6  caught=5
runner 3.3m/s    14.4   10m33    2085m    13898       1.4  caught=5
athlete 4.2m/s   18.8   13m50    3483m    19503       1.0  caught=5
greedy 3.3m/s    18.0   13m11    2609m    17977       9.4  caught=5
shambler 2.5     19.8   14m24    2159m    11915       1.6  caught=5
nightmare 3.3     7.2    4m60     987m     9890       1.8  caught=5
nightmare 4.5    14.2   10m13    2757m    22147       1.2  caught=5
```

Standing still kills you in about two minutes, jogging buys four, and going for
supply drops is worth about four extra waves at the same pace. Nobody survives —
past wave 20 horde speed climbs without a ceiling.

Change a constant in `src/config.ts`, rerun `npm run sim`, see what it did.

For UI work on an emulator, Android Studio's extended controls can push mock GPS
coordinates and replay a GPX route.

---

## Building the APK

```bash
npm run apk
```

That is the whole thing. It builds a standalone release APK on this machine and
drops it in your Downloads folder as `deadrun-1.0.0.apk`. No Expo account, no
build queue, no upload of your source to anyone.

**What it needs**, both located automatically if they are installed:

| | |
|---|---|
| **JDK 17+** | `winget install Microsoft.OpenJDK.17` |
| **Android SDK** | [command line tools](https://developer.android.com/studio#command-line-tools-only) unpacked to `<sdk>/cmdline-tools/latest`, then `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"` |

Set `ANDROID_HOME` if the SDK is not in one of the usual places. The script says
exactly what is missing and how to get it.

The first build downloads Gradle and compiles the native code, which took about
16 minutes here. Later ones are incremental and much faster. The build runs
against a staging copy in `~/.deadrun-build`, **not** in this folder — a Gradle
build writes tens of thousands of files, and OneDrive would try to sync every one
of them. Override that location with `DEADRUN_BUILD_DIR`.

### Size

React Native ships a full set of native libraries per CPU architecture, and the
default set of four is over half the APK. The build packs `arm64-v8a` (every
phone since roughly 2017) and `armeabi-v7a` (older 32-bit ones), and skips the
x86 pair, which only ever runs in an emulator. For the smallest possible file on
a modern phone:

```bash
DEADRUN_ABIS=arm64-v8a npm run apk
```

The APK is signed with the Expo template's debug keystore, which is stable across
rebuilds, so a new build installs over an old one. That is fine for sideloading
and for handing the file to friends. Play Store uploads are signed separately —
see below.

### Installing it

Copy the `.apk` to the phone and tap it, allowing "install unknown apps" for
whatever app you copied it with. Or over USB with developer mode on:

```bash
adb install -r deadrun-1.0.0.apk
```

---

## Publishing to Google Play

### Build the bundle

Play wants an `.aab`, not an APK, and one signed with a key you keep:

```bash
npx eas-cli build --profile production --platform android
```

First run will offer to generate an upload keystore — let EAS manage it, and
never lose it.

### Store listing assets

Pre-rendered in `assets/store/`:

- `play-icon-512.png` — 512×512 store icon
- `play-feature-graphic.png` — 1024×500 feature graphic

Regenerate both, plus every launcher icon, with `npm run assets`. The mark is
defined once as SVG in `scripts/make-icons.js`, so nothing drifts.

You still need to supply at least 2 phone screenshots — take them mid-run.

### Data safety form

The app collects nothing and sends nothing. Location is read on-device to place
the horde and is never transmitted or stored beyond the run summary in
`AsyncStorage`. On the Data Safety form: *no data collected, no data shared*.

### Permissions

`ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`, foreground only.
`ACCESS_BACKGROUND_LOCATION` is explicitly blocked in `app.json` — the app never
requests it, which avoids Google's background-location review process entirely.

Screen-off play is handled instead by **pocket mode**: a black screen with the
radar and audio cues that keeps the app in the foreground. Tap to bring the map
back.

### Submit

```bash
npx eas-cli submit --profile production --platform android
```

Goes to the internal track as a draft. Promote it from the Play Console when you
have tested it on a real street.

---

## Layout

```
src/
  engine.ts       the horde simulation — pure, testable, no React
  geo.ts          haversine, bearings, destination points
  config.ts       every tuning constant and the three difficulties
  types.ts        GameState and friends
  storage.ts      run history and settings (AsyncStorage)
  feedback.ts     audio + haptics, incl. the proximity heartbeat
  icons.tsx       the drawn SVG icon set and the DEADRUN mark
  theme.ts        palette and formatters
  tiles.ts        Web Mercator projection and the keyless basemap
  hooks/useLocationTracker.ts   GPS + compass
  components/     MapCanvas, Hud, Radar
  screens/        HomeScreen, GameScreen, GameOverScreen
scripts/
  simulate.ts     headless balance harness
  check-tiles.ts  projection checks against the live tile server
  build-apk.mjs   local release APK build
  make-audio.js   synthesises the sound effects as WAVs
  make-icons.js   renders every launcher and store image
```

No third-party art or audio — the sounds are synthesised from oscillators in
`scripts/make-audio.js` and every icon is drawn as SVG, so there is no licensing
to track.

---

## Before you ship this

This game deliberately makes people run outdoors while holding a phone. Keep the
safety card on the home screen, keep the vehicle check, and consider adding your
own liability wording to the store listing. Zombies are not real. Cars are.
