# The Pontifork mark

![the icon beside the name](pontifork-wordmark.png)

## The idea

*Pontifork* is *ponticello* — Italian for "little bridge", and the name of the
app it grew out of — and a tuning fork. The mark is drawn in Ponticello's
language, so the two read as a family:

- The **fork** is in the bridge's bleached maple: two tines, the yoke, a short
  stem, and a knob with Ponticello's round **heart** cut through it.
- The **waves** are the sound a struck fork rings out, four arcs in the
  colours Ponticello gives the cello's strings — **C green, G red, D blue,
  A yellow** — reading C G D A from left to right, as the strings do on
  Ponticello's icon.
- Each carries a soft drop shadow, so the fork stands in front of the waves and
  both lift off the indigo ground.

The fork is symmetric about its centre line, as Ponticello's bridge is.

## The master

**`pontifork-icon.svg` is the master.** It is the only brand file anyone
edits. It must keep three parts, which `tools/make-icons.py` checks before it
derives anything:

| Part | What the script looks for |
|---|---|
| Ground | a path filled with the indigo gradient |
| Waves | a group of exactly four wave paths, drawn *before* the fork |
| Fork | a group containing one even-odd path (the heart is the hole) |

Then regenerate everything else:

```
python3 tools/make-icons.py      # or: npm run icons
```

The script never writes the master. It reads it, splits it into those parts and
renders every variant with resvg (`tools/rasterize-svg.mjs`, a dev dependency),
because the master's drop-shadow filters and arcs are beyond Pillow. It asserts
what it cannot eyeball: that neither the fork nor the waves leave a circular
Android launcher mask or the maskable web icon's safe zone, that the themed
icon is truly one colour, and that the heart is still open at 48 and 32 px.

Set `ICON_PREVIEW_DIR` to also get 32/48/96/180 px previews and, on a Mac with
Icon Composer installed, Icon Composer's own rendering of the glass icon in its
Default, Dark, Clear and Tinted appearances (through its `ictool`), so the
Liquid Glass result is looked at rather than assumed.

## Colours

| Role | Hex |
|---|---|
| Ground, top → bottom (`BRAND.glow` → `BRAND.deep`) | `#7A6CFF` → `#2A1C9E` |
| Fork (bleached maple) | `#FAF8F3` |
| Waves C / G / D / A | `#30D158` / `#FF453A` / `#64D2FF` / `#FFD60A` |
| Accent on light / dark (`BRAND.indigo` / `indigoLight`) | `#4638D6` / `#9C95FF` |
| Splash ground (`BRAND.midnight`) | `#0B0A14` |

The same values as Ponticello's: D is drawn in cyan rather than system blue so
it holds on the indigo ground.

## What is derived

| File | Size | Role |
|---|---|---|
| `assets/expo.icon/` | vector | iOS icon (Icon Composer): fork in front, waves behind, as Liquid Glass layers at full bleed on the gradient |
| `assets/images/icon.png` | 1024² | base icon |
| `assets/images/android-icon-foreground.png` | 1024² | adaptive foreground: the mark inside the circular mask |
| `assets/images/android-icon-background.png` | 1024² | adaptive background: the gradient |
| `assets/images/android-icon-monochrome.png` | 1024² | Android 13 themed icon: one-colour silhouette |
| `assets/images/splash-icon.png` | 512² | splash, the tile on the midnight ground |
| `assets/images/favicon.png` | 48² | favicon |
| `assets/logo/pontifork-mark.svg` | vector | the mark without its tile |
| `assets/logo/pontifork-icon-512.png` | 512² | the tile, for the README |
| `assets/logo/pontifork-wordmark.png` | 1600×400 | icon and name, dark ink |
| `assets/logo/pontifork-wordmark-light.png` | 1600×400 | icon and name, light ink |
| `public/icons/icon-{192,512}.png` | — | the installable web app's icons |
| `public/icons/maskable-512.png` | 512² | the web app's maskable icon: full bleed, mark in the safe circle |
| `public/apple-touch-icon.png`, `public/favicon.png`, `public/og-image.png` | — | the web app's touch icon, favicon and link preview |
| `docs/assets/brand/*` | — | the site's copies, a full-bleed Apple touch icon and the link preview |

The iOS layers leave the master's drop shadows out: Icon Composer draws its own
per layer, and doubling them muddies the glass. Icon Composer reads a layer's
width and height as points on its 1024-point canvas, so the layers are written
at 1024 — a bare 100-unit viewBox renders as a speck.
