# Pontifork product site

A static page — `index.html`, `styles.css` and `assets/` — with no build step,
made the same way as Ponticello's (`../cello-hero/docs`).

## Where it is published

At **https://pontifork.bermeo.dev**, as a Vercel project of its own: the
repository imported with **Root Directory** `docs`, **Framework Preset**
*Other* and no build command, so this folder is served as it is. `vercel.json`
here sets clean URLs, caching and headers; `.vercelignore` keeps this README
out; `404.html` answers any address that is not a page.

The tuner itself is a separate project at **https://pontifork-online.bermeo.dev**
(the repository root, see `../vercel.json`). The page's "Open the tuner"
links go there, and the app's **Guide** button comes back here. The old
`/docs/` addresses on the app's domain redirect to this site.

## Search and link previews

The page's head carries everything a search engine or a chat preview reads:
title, description, canonical address, Open Graph and Twitter cards with the
link-preview image at an absolute address, and one JSON-LD block describing
the site, its author, the app, its source code, the six tuning steps and the
tour video. Beside it, `robots.txt`, `sitemap.xml` (with the screenshots and
the video) and `llms.txt`, a plain summary for AI search tools.

The JSON-LD `HowTo` repeats the six steps in `#how-to`: change a step's
heading and change it there too, or `npm run check:site` fails.

## Preview locally

```
npm run preview:site     # http://localhost:4174
```

It serves this folder with `vercel.json`'s rules, `.vercelignore` and the
404 page, as the deployment will.

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
pitch engine made of it. The chord book scenes (`chords-*`, `sequence-play`)
load stored settings and a saved sequence instead. Scenes are defined in `tools/capture-site-shots.mts`;
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

Every local file the page references exists, every image has alt text and a
size, every video an accessible name; the head, cards and structured data are
complete and point at the right domains; robots.txt and the sitemap agree with
the page. It checks the web app's page template the same way, and runs as part
of `npm run verify`.
