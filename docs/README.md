# Pontifork product site

A static page — `index.html`, `styles.css` and `assets/` — with no build step,
made the same way as Ponticello's (`../cello-hero/docs`).

## Where it is published

**With the web app.** The repository's own Vercel project (see `vercel.json`
at the root) builds the tuner with `npm run build:web`, which ends by copying
this folder into `dist/docs/`. The tuner is served at `/`, this page at
`/docs/`, and its "Open the tuner" links (`../`) go back to the app.

**On its own**, as Ponticello's site is: import the repository in Vercel again,
set **Root Directory** to `docs` and **Framework Preset** to *Other*, and leave
the build command empty. Its links to the tuner are relative, so point them at
the tuner's address first.

## Preview locally

```
npm run build:web && npm run preview:web     # http://localhost:4173/docs/
```

`preview:web` serves the build with `vercel.json`'s redirects, rewrites and
headers, so it behaves as the deployment will.

## The tuning catalogue

The `#tunings` section, between the `tunings:start` and `tunings:end` markers,
is generated from `src/domain/tunings.ts`: after changing a tuning, run
`npm run site:tunings` to rewrite it. `src/domain/__tests__/site.test.ts`
renders the same list and fails whenever the page differs, so a forgotten
regeneration cannot reach a deployment.

## Refreshing the screenshots

Every image in `assets/screenshots/` and `assets/video/tour.mp4` is captured
from the real web build by one script:

```
npm run build:web && npm run capture:shots          # everything
npm run capture:shots -- drop-d tunings             # some scenes
```

Chrome runs headless at a phone's size (402 × 874 points, saved 720 px wide)
or a laptop's (1280 × 800). The microphone is replaced by an oscillator bank
playing a string-like tone, so every note, cent and tick on screen is what the
pitch engine made of it. Scenes are defined in `tools/capture-site-shots.mjs`;
it needs Google Chrome (or `CHROME_PATH`) and ffmpeg for the video.

The page frames the phone screens in a CSS phone (`.device` in `styles.css`)
and the desktop ones in a CSS screen (`.screen`), so capture the bare screen,
not a mock-up.

The brand files in `assets/brand/` come from `python3 tools/make-icons.py` —
edit that script or the master icon, not the images. `og-image.png` is
composed from the screenshots and the icon, so run it again after capturing.

## Checks

```
npm run check:site
```

Every local file the page references exists, every image has alt text and
every video an accessible name, and the page has a title, a description and a
link-preview image. It runs as part of `npm run verify`.
