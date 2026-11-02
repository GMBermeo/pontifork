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

- `web.output` is `single`: an SPA. `public/index.html` is Expo's page
  template — the manifest, icons, link preview and dark-mode ground live there,
  not in `app.json` (Expo would add duplicates of the favicon and
  description).
- `vercel.json` deploys the export from the repository root: the app at `/`,
  the product site (`docs/`, copied in by `tools/bundle-docs.mjs`) at `/docs/`.
  `npm run preview:web` serves `dist/` with the same rules.
- The site is static HTML with no build step. Its tuning lists are generated
  (`npm run site:tunings`) and `site.test.ts` fails when they drift from the
  catalogue; `npm run check:site` fails on a missing file or unlabelled image.
- Screenshots and the tour video come from `npm run capture:shots`, which
  drives the real web build with a synthetic tone. Re-run it after a visible
  change, then `npm run icons` for the link preview. See `docs/README.md`.

## Before you commit

```
npm run verify
```

Type check, lint (Expo config plus SonarJS, zero warnings), the tests and the
site check. A justified lint exception gets an `eslint-disable-next-line <rule> -- reason`
comment, never a blanket disable.

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
