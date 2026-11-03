# Working on this repo

Pontifork is Ponticello's tuner (`../cello-hero`) forked into an app of its
own, for cello, guitar (6 and 7 strings) and bass (4, 5 and 6 strings).

Expo SDK 58 / React Native 0.88 / React 19.3. Read the versioned docs at
https://docs.expo.dev/versions/v58.0.0/ before writing any code. Ponticello is
still on SDK 57, so code moving back to it may need the RN 0.88 changes below
undone.

## React Native 0.88: the strict type API

SDK 58 makes React Native's strict TypeScript API the default, and 0.88 turns
host components into function components:

- **A ref to a host view is a `ReactNativeElement`, not a `View`.** Type it as
  `ComponentRef<typeof Pressable>` (or of whichever component it is on) —
  never `useRef<View>`, and never a deep import from `react-native/Libraries`.
- **Key events are part of React Native.** `onKeyDown` takes a `KeyDownEvent`
  and the key is `event.nativeEvent.key`. react-native-web passes the DOM
  `KeyboardEvent` as `nativeEvent`, so one handler serves the web, iPad and
  Android hardware keyboards alike (see `Segmented` in `ui/controls.tsx`).

## React Compiler is enabled

`app.json` sets `experiments.reactCompiler: true`. **Reanimated shared values
must use `.get()` and `.set()`, never `.value`.** The compiler cannot track
property access, so `sv.value = x` silently does nothing at runtime: the
needle renders its first frame and then freezes, with no error anywhere.

**Never read store state through a plain getter during render.** The compiler
memoises the call and the value never updates. Settings are read only through
the narrow hooks in `src/state/settings.ts` (`useInstrument`,
`useStringCount`, `useTuning`, `useA4`) and written through
`settingsActions`. There is deliberately no whole-object hook.

## Strict types

`tsconfig.json` turns on everything TypeScript offers short of
`isolatedDeclarations`: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`,
`noImplicitReturns`, `verbatimModuleSyntax`, `erasableSyntaxOnly` and the
unused/unreachable checks. ESLint adds typescript-eslint's
`strictTypeChecked` and `stylisticTypeChecked`, `strict-boolean-expressions`
and an exhaustive-`switch` check. What that means day to day:

- **An index may miss.** `list[i]` is `T | undefined`. Say what you know:
  `itemAt(list, i)` (`domain/lists.ts`) throws when the index is wrong;
  `NonEmpty<T>` types a list that always has a first item (a tuning's notes,
  an instrument's string counts, a catalogue); `ByPitchClass<T>` is a
  12-tuple indexed by `PitchClass`, and `Letter` indexes the seven letters.
- **The DSP kernels are the exception.** `fft.ts`, `mpm.ts`, `decimate.ts`,
  `flux.ts`, `chordSynth.ts` and `sources/types.ts` index typed arrays with
  `!` inside loops bounded by those arrays: a `?? 0` per sample would cost a
  branch on the audio thread. Nowhere else.
- **Stored data is `unknown` until checked.** Sanitizers read a stored copy
  as `Stored<T>` (`state/stored.ts`): every field optional and `unknown`.
- **Optional means absent, not `undefined`.** Leave a property out (spread
  `...(x === undefined ? {} : { x })`) rather than passing `undefined`, or
  declare it `?: T | undefined` when undefined is a real value.
- **Props are `Readonly<…>`**; type-only imports are `import { type X }`; no
  enums, namespaces or parameter properties (`erasableSyntaxOnly`), so the
  `tools/*.mts` scripts run in Node 24 without a build step.

## How a reading is made

```
mic (sources/useMicSource.{native,web}.ts)
 → PitchEngine        dual-rate MPM: 16 kHz high band, 4 kHz low band
 → TunerPitchSmoother rolling median of the frequency (smoothing.ts)
 → resolveTarget      which string of the tuning it is aimed at (domain/targets.ts)
 → TunerTracker       cents from that target, throttled reading (tunerTracker.ts)
 → usePitch           shared values for the needle and meter, listeners for text
```

- The engine's lowest frequency is per instrument (`detectionFloorHz`), down
  to ~22 Hz for a drop-A five-string bass, and clamped to what the low band's
  window can resolve at the hardware's actual sample rate.
- When the two bands disagree by a whole-number ratio, the low band's NSDF at
  the high band's period decides which is real (`PitchEngine.reconcile`).
  Ponticello's rule ("ratio 2 → trust the low band") reads a guitar's B and
  high E strings an octave low; `PitchEngine.test.ts` guards this.
- The attack gate has a refractory period. Without it a steady tone re-triggers
  the gate every few hops and the engine holds its first pitch forever;
  `flux.test.ts` guards this.
- Only the frequency is smoothed. The target string is chosen from the median,
  so a noisy frame can never move it. Text shows the true cents; only the
  needle is eased.

## The tuning catalogue

`src/domain/tunings.ts` is written out note by note so anyone can check a line
against a chart. `tunings.test.ts` checks the promises the names make (every
"half step down" is standard minus a semitone, every drop is a lowered
standard with its low string down a tone, every open tuning rings its chord).
A tuning `id` is stored in settings: never rename one. To add a tuning, add a
line to the right setup and run the tests.

Neighbouring strings may share a note: the QOTSA tuning (`qotsa`, G G D G D D
on six strings, with derivatives for seven strings and every bass) pairs its
outer strings in unison. A tuner following whichever string is played cannot
tell a pair apart, so `candidateStrings` (`domain/targets.ts`) names both:
the dial reads "String 6 or 5", both pegs light, and a pair string coming
into tune ticks the first of the two not yet ticked (`applyStatusChange`).
Locking a string makes it unambiguous again.

## The chord book

The Chords tab (`src/app/(tabs)/chords.tsx`, built from `src/components/chords/`)
lists 120 chords (12 roots × the 10 types in `domain/chords/chordTypes.ts`)
for whatever instrument, tuning and capo are in use. It shares the tuner's
settings: there is no second tuning.

- **Shapes follow the tuning** (`domain/chords/book.ts`, `tuningRelation`).
  Every string moved by the same amount (half step down, C standard, a capo,
  bass tenor): the standard shapes, renamed by the shift, so B's page in half
  step down shows the C shape and labels it. Drop tunings: the same shapes with
  the lowest string fretted two higher (or left out), plus the one-finger
  power chord. Anything else (open tunings, DADGAD, double drop D, QOTSA, the
  cello's scordaturas): shapes found by search for that tuning. Unison strings
  leave some chords out of one hand's reach (no augmented chord without G or D
  in QOTSA; 22 of the 120 chords on its four-string bass); `chords.test.ts`
  proves each missing shape unreachable, and the book shows every place the
  notes fall instead.
- **Guitar shapes are written out by hand** (`guitarShapes.ts`): the open
  chords and the E and A shape barres, with a teacher's fingering. A seven-
  string adds the E shape on strings 7–4. Bass and cello shapes come from
  `search.ts` (the cello's hand frames are Ponticello's). `chords.test.ts`
  checks that every shape in every tuning sounds its chord within one hand.
- **The book lists chords by how they sound**; the shape's own name is the
  small label. Roots are spelt as a chart spells them (`spelling.ts`), the
  tuning breaking F♯/G♭-style ties; notes are spelt from the root's letter.
- **Keys** (`keys.ts`): a key opens its own page in degree order and puts its
  chords first on every other page. Minor keys include the major V.
- **Diagrams** are geometry first (`diagram.ts`, tested in Node) and drawn by
  `components/chords/ChordDiagram.tsx` with `react-native-svg`.
- **Sequences** (`state/sequencesModel.ts`, persisted by `state/sequences.ts`)
  keep chords by sound, the shape picked, and the setup they were made for.
  Play-through is silent by design: it shows the changes every
  `PLAY_THROUGH_MS`.
- **Sound** (`audio/chordSynth.ts`): Karplus–Strong plucks with an all-pass
  tuning correction, and an additive bowed tone for the cello, at the
  tuner's A4. `chordSynth.test.ts` measures the pitch it plays. Playback is
  per platform (`audio/playback/playSamples.{web,native}.ts`): Web Audio in a
  browser; on iOS and Android a WAV in the cache played by expo-audio, which
  cannot play raw samples.

### Tabs

`src/app/(tabs)/_layout.tsx` is the system tab bar (`expo-router/native-tabs`).
In a browser that component draws a floating pill over the page, so
`_layout.web.tsx` builds a bottom bar from `expo-router/ui`'s headless tabs;
its `TabSlot` must be allowed to shrink or every page grows past the window.
Content pinned to the bottom of a tab pads by `useTabBarInset()`: iOS gives
each tab its own safe area including the floating bar; Android and the web
already sit above theirs.

## Sizes are design units, not pixels

Everything visual is written against an 829 × 690 canvas and converted through
`useTheme().s()`, which never goes below 1.0: phones reflow to the compact
(single-column) layout rather than shrink. See `src/theme/scale.ts`.

## Folders and imports

Routes in `src/app` are composition only; the tuner's pieces live in
`src/components/tuner/`. Pure logic goes in `src/domain` (or a plain `.ts`
beside its component) and gets a test.

Every top-level folder has an `index.ts` barrel: `@audio`, `@components`,
`@domain`, `@state`, `@theme` (see `tsconfig.json` `paths` and
`tools/pathAliases.ts`, which must stay in step). Use the alias across
folders; inside a folder use relative imports. A new file must be added to its
folder's `index.ts`.

Tests are pure TypeScript and run in Node: nothing in `src/domain`,
`src/audio` (except `usePitch` and the mic sources) or `src/state/settingsModel.ts`
may import React Native. Tests import files directly, never the `@audio`
barrel, which pulls in Reanimated.

## The microphone

The mic is open only while the tuner screen is focused and the app is active.
On the web a browser opens a microphone only after a gesture, so listening
starts with a button; the permission is held by the screen so it outlives the
tuning sheet. The web tap disables echo cancellation, noise suppression and
automatic gain: all three are built for speech and wreck a held string.

## Dependencies

Add native packages with `npx expo install`, never a bare `npm install`, and
check with `npx expo install --check` (or `npx expo-doctor`).

`expo-asset` is a direct dependency on purpose. `expo-audio` asks for it with a
loose range, and on SDK 57 a fresh install resolved the next SDK's, which
imported a module `expo` did not have and broke every bundle. Pinned with the
rest of the SDK, it cannot drift ahead of `expo` again.

Moving to a new SDK: `npx expo install expo@^<sdk>` then
`npx expo install --fix`. If npm refuses on peer dependencies, delete
`node_modules` and `package-lock.json` and install again — the conflict is the
old SDK's packages still on disk, not the new ones.

## The icon

`assets/logo/pontifork-icon.svg` is the only brand file anyone edits; every
icon, splash, favicon, web-app icon, wordmark and the iOS Icon Composer
document (`assets/expo.icon`) is derived from it by `python3 tools/make-icons.py`,
which also checks the results (circular launcher mask, maskable safe zone,
one-colour themed icon, the heart open at 48 and 32 px). Never edit a derived
file. See `assets/logo/README.md`.

## The web app and the product site

Two Vercel projects from this repository, on two domains (the addresses live
in `src/theme/brand.ts` as `APP_URL` and `SITE_URL`):

- **The web app**, `https://pontifork-online.bermeo.dev`: the repository root,
  `vercel.json`. `web.output` is `single`, an SPA. `public/index.html` is
  Expo's page template: manifest, icons, link preview, structured data and the
  dark-mode ground live there, not in `app.json` (Expo would add duplicates of
  the favicon and description). The old `/docs/…` addresses redirect to the site.
- **The product site**, `https://pontifork.bermeo.dev`: Root Directory `docs`,
  `docs/vercel.json`, static HTML with no build step. Its tuning lists are
  generated (`npm run site:tunings`) and `site.test.ts` fails when they drift
  from the catalogue.
- `npm run preview:web` (port 4173) and `npm run preview:site` (4174) serve
  each as Vercel will, from `tools/serve-web.mts`.

### Search

- Each route of the app renders `<PageMeta>` (`components/ui/PageMeta.web.tsx`,
  `expo-router/head`): its title, description, canonical address and whether
  it is indexed. The template marks those tags `data-rh` so the route's
  replace them rather than doubling them, and has no canonical of its own (a
  static one would contradict the route's). `PageMetaProvider` wraps the root
  layout: a single-page build has no Head context otherwise. The apps render
  nothing (`PageMeta.tsx`).
- A new route that should be found gets `indexed` left on and a line in
  `public/sitemap.xml`; one that shows the player's own data gets
  `indexed={false}` and a `Disallow` in `public/robots.txt`.
- `npm run check:site` (`tools/check-site.mts`) checks both pages' head,
  cards, structured data, robots.txt and sitemap; read its header for the
  rules. The site's JSON-LD `HowTo` must match the `#how-to` steps.
- Screenshots and the tour video come from `npm run capture:shots`, which
  drives the real web build with a synthetic tone (and, for the chord book,
  stored settings and a saved sequence). Re-run it after a visible
  change, then `npm run icons` for the link preview. See `docs/README.md`.

## The Android APK

`npm run apk` (`tools/build-apk.sh`) prebuilds `android/` from `app.json`
when it is missing or older, builds `assembleRelease` for arm64 only, and
copies the result to `releases/Pontifork-v<version>.apk`. On this Mac the JVM
cannot open outbound connections, so Gradle goes through `tools/dev-proxy.mts`
on loopback; the script starts and stops it. A release bumps `expo.version`
and `android.versionCode` (and `ios.buildNumber`) together.

## Before you commit

```
npm run verify
```

Type check, lint (Expo config, typescript-eslint's strict type-checked rules
and SonarJS, zero warnings), the tests and the site check. A justified lint
exception gets an `eslint-disable-next-line <rule> -- reason` comment, never a
blanket disable; the two file-scoped ones in `eslint.config.mjs` say why.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
