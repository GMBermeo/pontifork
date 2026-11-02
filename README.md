<p align="center">
  <img src="assets/logo/pontifork-icon-512.png" alt="" width="104" height="104">
</p>

<h1 align="center">Pontifork</h1>

<p align="center">
  Every string, in tune — a tuner for <strong>cello</strong>, <strong>guitar</strong> (6 and 7 strings) and
  <strong>bass</strong> (4, 5 and 6 strings), for iOS, Android and any browser.<br>
  <a href="docs/index.html">Product site</a> · <a href="#publish-on-vercel">Publish on Vercel</a> · <a href="#the-icon">The icon</a>
</p>

<p align="center">
  <img src="docs/assets/screenshots/tuner-guitar.webp" alt="Guitar in standard tuning: the D string nine cents flat, Tune up; the two lower strings ticked" width="200">
  <img src="docs/assets/screenshots/drop-d.webp" alt="Drop D while the low string still sounds E: plus two hundred cents, Tune down" width="200">
  <img src="docs/assets/screenshots/tunings.webp" alt="The tuning list for six-string guitar" width="200">
  <img src="docs/assets/screenshots/tuner-cello-dark.webp" alt="Cello in the dark theme with all four strings ticked" width="200">
</p>

It is the tuner from [Ponticello](https://github.com/GMBermeo/ponticello)
forked into an app of its own: the same dual-rate pitch engine, generalised
from the cello's range to everything from a five-string bass in drop A
(27.5 Hz) to the upper frets of a guitar. Built with Expo SDK 58 and React
Native 0.88.

## What it does

- **Measures against the string, not the nearest note.** Moving from standard
  to drop D, the low string reads "D2 · hearing E2 · +200¢ · tune down", not
  "E2, in tune".
- **Follows whichever string you play**, or tap a string to lock onto it when
  you are bringing it a long way.
- **Ticks each string** once it has been held in tune for a moment (with a
  haptic tap on phones), and un-ticks it if it drifts while you tune the rest.
- **Reference pitch** from A = 415 Hz (baroque) to 466 Hz, in whole hertz.
- **Keeps the screen awake** while listening, and releases the microphone when
  you leave the tuner or switch apps. Nothing is recorded or sent anywhere.
- **Runs in any browser**, and installs to a phone's home screen as a web app.

## Tunings

| Setup | Tunings |
|---|---|
| Cello | Standard (C G D A), half step down, Bach Suite No. 5 (A→G), Kodály Sonata Op. 8 (B F♯ D A) |
| Guitar, 6 strings | Standard, half step down (E♭), whole step down (D), C♯, C and B standard · Drop D, C♯, C, B, A♯/B♭, A · Double drop D · Open D, D minor, E, G, A, C · DADGAD |
| Guitar, 7 strings | Standard (B E A D G B E), half step down, whole step down · Drop A, G♯/A♭, G, F♯ |
| Bass, 4 strings | Standard, half step down, whole step down, C♯, C and B (BEAD) standard · Drop D, C♯, C, B, A♯/B♭, A · Tenor (ADGC) |
| Bass, 5 strings | Standard (B E A D G), half step down, whole step down · Drop A · High C (EADGC) |
| Bass, 6 strings | Standard (B E A D G C), half step down, whole step down · Drop A |

Every note of every tuning is on the [product site](docs/index.html#tunings).

## Running it

```sh
npm install
npm run web       # browser; press "Enable microphone"
npm run ios       # Expo Go or a dev build
npm run android
```

The microphone needs a secure context on the web: `localhost` works, a LAN IP
over plain HTTP does not.

## Publish on Vercel

One Vercel project serves both the tuner and its product site: the web app at
`/`, the site at `/docs/`. Everything is in [`vercel.json`](vercel.json).

1. Import the repository in Vercel. Leave **Root Directory** at the repository
   root; `vercel.json` sets the rest (*Other* framework, `npm ci`,
   `npm run build:web`, output in `dist/`).
2. Deploy. Or from the command line: `npx vercel --prod`.

`npm run build:web` exports the app with `expo export --platform web` (a
single-page app: `web.output` is `single`) and copies the site into
`dist/docs/`. `vercel.json` then:

- redirects `/docs` to `/docs/`, so the site's relative links resolve;
- falls back to `index.html` for any path that is not a file, so a deep link
  such as `/tunings` opens the app (Vercel checks the filesystem before
  rewrites, so `/docs/` and every asset are served as they are);
- caches Expo's content-hashed bundles and fonts forever;
- allows the microphone to this origin only, so another site that embeds the
  tuner in a frame cannot listen through it.

Try the deployment before it exists with `npm run build:web && npm run
preview:web`, which serves `dist/` applying `vercel.json`'s redirects, rewrites
and headers in Vercel's order.

The web app is installable: `public/index.html` (Expo's page template) links a
manifest, touch icon and maskable icon, and sets the ground colour so there is
no white flash in dark mode. Vercel serves it over HTTPS, which browsers
require before they open a microphone.

The product site can also be deployed on its own, as Ponticello's is — see
[`docs/README.md`](docs/README.md).

## The icon

The icon is made the way Ponticello's is: one hand-drawn master,
[`assets/logo/pontifork-icon.svg`](assets/logo/pontifork-icon.svg), from which
`python3 tools/make-icons.py` (or `npm run icons`) derives every other brand
file and checks the results. On iOS it is an **Icon Composer** document,
[`assets/expo.icon`](assets/expo.icon), with the fork and the waves as separate
Liquid Glass layers. See [`assets/logo/README.md`](assets/logo/README.md) for
the idea, the contract the master keeps and what is derived.

## Checks

```sh
npm run verify    # type check, lint, tests, site check
```

The tests are pure TypeScript in Node. They run the pitch engine over every
open string in the catalogue, check every tuning against the promise in its
name, check that the product site lists exactly the catalogue, and cover the
string targeting, smoothing and settings validation. `npm run check:site`
checks the site's files resolve and its images and video are labelled.

| Command | What it does |
|---|---|
| `npm run build:web` | Export the web app and copy the product site into `dist/docs/` |
| `npm run preview:web` | Serve `dist/` as Vercel will |
| `npm run icons` | Derive every icon, splash, wordmark and web icon from the master |
| `npm run capture:shots` | Capture the site's screenshots and tour video from the web build |
| `npm run site:tunings` | Rewrite the site's tuning lists from the catalogue |

## Code map

See [AGENTS.md](AGENTS.md) for how a reading is made and the project's
conventions. The repo is indexed with [graft](https://www.npmjs.com/package/@nanonets/graft):
`graft map` for a tour, `graft ask "<question>" --source` to find code.

## Credits

App development by **Guilherme Yuri Bermeo** — [gm.bermeo.dev](https://gm.bermeo.dev).
Built with [Expo](https://expo.dev) and React Native; the pitch detector uses
the McLeod Pitch Method. On iOS the interface is set in the system face; on
Android, the web and in the brand it is
[Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type. Licensed
under the MIT License — see [`LICENSE`](LICENSE).
