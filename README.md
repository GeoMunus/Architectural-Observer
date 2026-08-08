# Observer AO — Architectural Observer

A native Android app that watches, remembers, and reasons about the space around it.
Point the camera at a room and Observer AO samples the frame into brightness zones,
folds those signals into memories, extracts recurring patterns, forms concepts, argues
with itself through a skeptic, and proposes what to look at next.

It started as a browser prototype of a multi-agent observation loop. This repository is
that loop rebuilt as a real, installable Android application.

## Getting the APK

Every push builds an APK in GitHub Actions.

1. Open the **Actions** tab → the most recent **Build Android APK** run.
2. Download the **observer-ao-apk** artifact and unzip it.
3. Copy `observer-ao-<version>-debug.apk` to your phone and open it.
4. Android will warn about installing from an unknown source — allow it for your
   browser or file manager, since the APK is not distributed through Play.

On first launch, tap **Enable Camera Vision** and grant the camera permission to let the
observer read the room. The app is fully usable without it — it will observe its own
interface instead.

The debug APK is signed with Android's standard debug key, which is enough to install
and run but not to publish. See [Release signing](#release-signing) for a store-ready build.

## How it works

Each analysis cycle runs eleven agents in order over a shared `World`:

| Agent | Responsibility |
| --- | --- |
| Vision | Samples the camera frame into a 6×8 brightness grid, or reads the app's own interface |
| Sensor | Turns the accelerometer, compass, and posture into observable signals |
| Event | Diffs this cycle's signature against the last to detect change |
| Memory | Stores snapshots scored by importance and confidence |
| Pattern | Finds recurring structures across recent memories |
| Concept | Builds an emergent vocabulary from objects, patterns, and the mission brief |
| Reasoning | Converts signals into architectural interpretation |
| Planning | Ranks the interpretations into prioritized goals |
| Curiosity | Raises the questions the model cannot yet answer |
| Skeptic | Undercuts conclusions that the evidence does not support |
| Action | Synthesizes the next best moves for the operator |

The app is organized into four tabs: **Observe** (vision, mission brief, metrics),
**Graph** (the model as a pannable, pinch-zoomable node map), **Streams** (timeline,
objects, events, memories, concepts, patterns, goals), and **Chat** (ask the observer
what it sees, infers, or intends).

### Privacy

Camera frames are downsampled and analyzed entirely on device; only derived numbers
(brightness, contrast, motion) ever enter the model. No image, and no observation, is
transmitted anywhere — the app has no backend and makes no network requests at runtime.
The camera is released whenever the app moves to the background.

## Project layout

```
src/                  Web app source (ES modules, no framework)
  js/core/            World, Thing, Event, Memory, Concept primitives
  js/agents/          The eleven agents
  js/ui/              Graph, renderer, shell chrome
  js/native/          Capacitor bridge with browser fallbacks
  styles/app.css      Mobile-first stylesheet
  assets/             Self-hosted fonts and generated icons
android/              Native Android project (Capacitor)
scripts/              Icon generation and the Playwright smoke test
build.mjs             esbuild bundler → www/
www/                  Build output (generated, not committed)
```

## Local development

```bash
npm install
npm run build          # bundle src/ into www/
npm run serve          # serve www/ at http://localhost:5173
npm run watch          # rebuild JS on change
```

The same bundle runs in a desktop browser and inside the APK; every native call
degrades gracefully when Capacitor is absent, so most work can be done in a browser.

### Building the APK locally

Requires the Android SDK (platform 35, build-tools 35.0.0) and JDK 21:

```bash
npm run apk            # build + cap sync + gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

`npx cap sync android` must run before Gradle: it copies the web build into the native
project and regenerates the Capacitor Gradle includes, which are not committed.

### Tests

```bash
npm run build && npm run serve &
node scripts/smoke-test.mjs
```

The smoke test drives the app in a mobile-sized Chromium: it runs cycles, taps graph
nodes, switches tabs and streams, exercises chat, verifies persistence across a reload,
checks every tab for horizontal overflow, and runs camera vision against Chromium's
fake capture device. CI runs it before assembling any APK.

### Regenerating icons

```bash
node scripts/generate-icons.mjs
```

Rasterizes the launcher icons, adaptive foregrounds, and splash screens from inline SVG
using Chromium, so the project needs no native image tooling.

## Release signing

The release variant is unsigned unless signing material is supplied. To produce a signed
release APK in CI, add these repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

Create a keystore with:

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias observer-ao
```

Keep the keystore out of the repository — `.gitignore` already excludes `*.jks`.
Push a `v*` tag (or run the workflow manually with **release** checked) to publish the
APKs to a GitHub release.

## App details

| | |
| --- | --- |
| Package | `io.observerao.app` |
| Min SDK | 23 (Android 6.0) |
| Target SDK | 35 (Android 15) |
| Permissions | `CAMERA` (optional), `INTERNET` |
| Frameworks | Capacitor 7, vanilla ES modules, esbuild |
