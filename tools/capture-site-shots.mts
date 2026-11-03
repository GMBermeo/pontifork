#!/usr/bin/env node
/**
 * The product site's screenshots and tour video, captured from the real web
 * build with the real pitch engine listening:
 *
 *     npm run build:web && npm run capture:shots
 *
 * Chrome runs headless against `dist/` (served as Vercel would, see
 * serve-web.mts) at a phone's size. The microphone is replaced by an
 * oscillator bank playing a string-like harmonic series, so every reading on
 * screen — the note, the cents, the ticks — is what the engine actually made
 * of a tone, not a mock-up. Settings are written to storage before each load,
 * the same way the app reads them back.
 *
 * Needs Google Chrome (or CHROME_PATH) and ffmpeg for the video.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch, type Browser, type Page, type ScreenshotOptions, type Viewport } from 'puppeteer-core';

import { serve, siteFor } from './serve-web.mts';

const ROOT = join(import.meta.dirname, '..');
const SHOTS = join(ROOT, 'docs', 'assets', 'screenshots');
const VIDEO = join(ROOT, 'docs', 'assets', 'video');
const CHROME = process.env['CHROME_PATH'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env['FFMPEG_PATH'] ?? 'ffmpeg';
/** Clear of the two preview servers, so a capture can run beside them. */
const PORT = 4175;
const ORIGIN = `http://localhost:${PORT}`;

/** A current iPhone's logical screen, captured 720 pixels wide like Ponticello's screenshots. */
const PHONE: Viewport = { width: 402, height: 874, deviceScaleFactor: 720 / 402 };
const DESKTOP: Viewport = { width: 1280, height: 800, deviceScaleFactor: 1.25 };

/** What the fake microphone exposes on `window`, for the scenes to play notes through. */
interface ToneControl {
  /** A frequency to start on once the page asks for the microphone. */
  pending: number;
  set?: (hz: number) => void;
  /** A peg being turned: glide from one pitch to another. */
  glide?: (from: number, to: number, seconds: number) => void;
}

declare global {
  interface Window {
    __tone: ToneControl;
  }
}

/**
 * Installed before the page's own scripts: `getUserMedia` returns an
 * oscillator bank instead of a microphone. Harmonics are weighted like a
 * plucked string, so the engine faces a realistic spectrum.
 */
function installToneSource(): void {
  const weights = [1, 0.6, 0.4, 0.25, 0.15];
  window.__tone = { pending: 0 };
  navigator.mediaDevices.getUserMedia = async (): Promise<MediaStream> => {
    const context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(destination);
    const oscillators = weights.map((weight, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = weight;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      return { oscillator, harmonic: i + 1 };
    });
    const set = (hz: number): void => {
      const now = context.currentTime;
      oscillators.forEach(({ oscillator, harmonic }) => oscillator.frequency.setValueAtTime(hz * harmonic, now));
      master.gain.setTargetAtTime(hz > 0 ? 0.25 : 0, now, 0.01);
    };
    window.__tone.set = set;
    window.__tone.glide = (from: number, to: number, seconds: number): void => {
      const now = context.currentTime;
      master.gain.setTargetAtTime(0.25, now, 0.01);
      oscillators.forEach(({ oscillator, harmonic }) => {
        oscillator.frequency.setValueAtTime(from * harmonic, now);
        oscillator.frequency.exponentialRampToValueAtTime(to * harmonic, now + seconds);
      });
    };
    if (window.__tone.pending > 0) set(window.__tone.pending);
    return destination.stream;
  };
}

const hz = (midi: number, cents = 0, a4 = 440): number => a4 * 2 ** ((midi - 69) / 12) * 2 ** (cents / 1200);
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const SETTINGS_KEY = 'pontifork/settings/v1';
const SEQUENCES_KEY = 'pontifork/sequences/v1';

/** The settings a scene starts from: anything left out is the app's default. */
interface Setup {
  instrument?: 'cello' | 'guitar' | 'bass';
  strings?: number;
  tuning?: string;
  a4?: number;
  /** Chord book settings, stored as the app stores them. */
  book?: Readonly<Record<string, unknown>>;
}

function settings({ instrument = 'guitar', strings = 6, tuning = 'standard', a4 = 440, book = {} }: Readonly<Setup>): object {
  const counts = { cello: 4, guitar: 6, bass: 4, [instrument]: strings };
  return { instrument, strings: counts, tunings: { [`${instrument}-${strings}`]: tuning }, a4, book };
}

/**
 * A saved sequence in half step down: the G, C, D and Em shapes every
 * guitarist knows, which sound a semitone lower: G♭, B, D♭ and E♭m.
 */
const VERSE_CHORDS: readonly (readonly [root: number, type: string])[] = [[6, 'maj'], [11, 'maj'], [1, 'maj'], [3, 'm']];
const VERSE = {
  openId: 'verse',
  sequences: [{
    id: 'verse', name: 'Verse',
    madeFor: { instrument: 'guitar', strings: 6, tuningId: 'half-step-down', capo: 0 },
    chords: VERSE_CHORDS.map(([root, type], i) => ({ id: `c${i}`, root, type, shape: 0 })),
  }],
};

interface Scene {
  viewport?: Viewport;
  scheme?: 'light' | 'dark';
  path?: string;
  setup: Setup;
  sequences?: object | null;
}

function store(key: string, value: string): void {
  localStorage.setItem(key, value);
}

async function open(browser: Browser, { viewport = PHONE, scheme = 'light', path = '/', setup, sequences = null }: Readonly<Scene>): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.evaluateOnNewDocument(installToneSource);
  await page.evaluateOnNewDocument(store, SETTINGS_KEY, JSON.stringify(settings(setup)));
  if (sequences !== null) await page.evaluateOnNewDocument(store, SEQUENCES_KEY, JSON.stringify(sequences));
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Every scroll view on the page, at its top (or, with `toEnd`, its bottom). */
function scrollAll(toEnd: boolean): void {
  document.querySelectorAll('div').forEach((el) => {
    el.scrollTop = toEnd ? el.scrollHeight : 0;
  });
}

async function listen(page: Page): Promise<void> {
  await page.waitForSelector('[aria-label="Enable microphone"]');
  await page.click('[aria-label="Enable microphone"]');
  await page.waitForFunction(() => typeof window.__tone.set === 'function');
  // Clicking scrolled the button into view; put the tuner back at the top.
  await page.evaluate(scrollAll, false);
}

/** Runs in the page: sounds one frequency (0 for silence). */
function setTone(frequency: number): void {
  window.__tone.set?.(frequency);
}

/** Runs in the page: glides between two frequencies. */
function glideTone(from: number, to: number, seconds: number): void {
  window.__tone.glide?.(from, to, seconds);
}

interface Note {
  cents?: number;
  ms?: number;
  a4?: number;
}

/** Sounds `midi` at `cents` off for `ms`, as the engine will hear it. */
async function play(page: Page, midi: number, { cents = 0, ms = 1300, a4 = 440 }: Readonly<Note> = {}): Promise<void> {
  await page.evaluate(setTone, hz(midi, cents, a4));
  await wait(ms);
}

async function tapString(page: Page, numeral: number): Promise<void> {
  await page.click(`[aria-label^="String ${numeral},"]`);
}

async function shot(page: Page, name: string, options: Readonly<ScreenshotOptions> = {}): Promise<void> {
  await wait(250);
  await page.screenshot({ path: join(SHOTS, `${name}.webp`), type: 'webp', quality: 86, ...options });
  console.log(`  ${name}.webp`);
  await page.close();
}

/** Scrolls whichever scroll view holds the element with this exact text so the element sits near the top. */
async function scrollTo(page: Page, text: string): Promise<void> {
  await page.evaluate((label: string) => {
    const target = [...document.querySelectorAll('div')].find((el) => el.textContent === label && el.children.length === 0);
    target?.scrollIntoView({ block: 'start' });
  }, text);
}

/** Scrolls the element matching `selector` to the top of whichever view scrolls it. */
async function scrollToSelector(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector);
  await page.evaluate((target: string) => {
    document.querySelector(target)?.scrollIntoView({ block: 'start' });
  }, selector);
}

const HALF_STEP_DOWN: Setup = { tuning: 'half-step-down' };

type SceneScript = (browser: Browser) => Promise<void>;

const SCENES: Readonly<Record<string, SceneScript>> = {
  async 'tuner-guitar'(browser) {
    const page = await open(browser, { setup: {} });
    await listen(page);
    await play(page, 40);
    await play(page, 45, { cents: 2 });
    await play(page, 50, { cents: -9, ms: 1000 });
    await shot(page, 'tuner-guitar');
  },
  async 'drop-d'(browser) {
    const page = await open(browser, { setup: { tuning: 'drop-d' } });
    await listen(page);
    await play(page, 40);
    await shot(page, 'drop-d');
  },
  async tunings(browser) {
    const page = await open(browser, { path: '/tunings', setup: { tuning: 'drop-d' } });
    await scrollTo(page, 'Drop');
    await shot(page, 'tunings');
  },
  async 'tuner-cello-dark'(browser) {
    const page = await open(browser, { scheme: 'dark', setup: { instrument: 'cello', strings: 4 } });
    await listen(page);
    for (const midi of [36, 43, 50]) await play(page, midi);
    await play(page, 57, { cents: 1, ms: 1400 });
    await shot(page, 'tuner-cello-dark');
  },
  async 'tuner-bass'(browser) {
    const page = await open(browser, { setup: { instrument: 'bass', strings: 5 } });
    await listen(page);
    await play(page, 28);
    await play(page, 23, { cents: -14, ms: 1000 });
    await shot(page, 'tuner-bass');
  },
  async 'locked-seven'(browser) {
    const page = await open(browser, { scheme: 'dark', setup: { strings: 7, tuning: 'drop-a' } });
    await listen(page);
    await tapString(page, 7);
    await play(page, 35);
    await shot(page, 'locked-seven');
  },
  async reference(browser) {
    const page = await open(browser, { scheme: 'dark', setup: { a4: 442 } });
    await listen(page);
    await play(page, 45, { a4: 442, ms: 600 });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await scrollTo(page, 'Reference pitch');
    await play(page, 45, { a4: 442, ms: 700 });
    await shot(page, 'reference');
  },
  async 'chords-shapes'(browser) {
    const page = await open(browser, { path: '/chords', setup: HALF_STEP_DOWN, sequences: VERSE });
    await scrollToSelector(page, '[aria-label="Chord type"]');
    await shot(page, 'chords-shapes');
  },
  async 'chords-detail'(browser) {
    const page = await open(browser, { path: '/chords', scheme: 'dark', setup: { ...HALF_STEP_DOWN, book: { sound: false } } });
    // The grid renders rows as they scroll into view; B is the last.
    await page.evaluate(scrollAll, true);
    await page.waitForSelector('[aria-label^="B. "]');
    await page.click('[aria-label^="B. "]');
    await scrollToSelector(page, '[aria-label^="B, C shape"]');
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach((el) => {
        if (el.scrollTop > 0) el.scrollTop -= 64;
      });
    });
    await shot(page, 'chords-detail');
  },
  async 'chords-key'(browser) {
    const page = await open(browser, { path: '/chords', setup: { book: { tab: 'key', key: '7-major' } } });
    await scrollToSelector(page, '[aria-label="Chord type"]');
    await shot(page, 'chords-key');
  },
  async 'sequence-play'(browser) {
    const page = await open(browser, { path: '/sequence?play=1', scheme: 'dark', setup: HALF_STEP_DOWN, sequences: VERSE });
    await wait(2300);
    await shot(page, 'sequence-play');
  },
  async desktop(browser) {
    const page = await open(browser, { viewport: DESKTOP, setup: {} });
    await listen(page);
    for (const midi of [40, 45, 50]) await play(page, midi);
    await play(page, 55, { cents: 4, ms: 1300 });
    await shot(page, 'desktop');
  },
  async 'desktop-dark'(browser) {
    const page = await open(browser, { viewport: DESKTOP, scheme: 'dark', setup: { instrument: 'bass', strings: 4, tuning: 'drop-d' } });
    await listen(page);
    await play(page, 33);
    await play(page, 28, { cents: 0, ms: 1200 });
    await shot(page, 'desktop-dark');
  },
};

/**
 * The hero video: tuning a guitar from the bottom string up, the pegs turned
 * by ear — each string glides in from off pitch, settles, and gets its tick.
 */
async function tour(browser: Browser): Promise<void> {
  const page = await open(browser, { setup: {} });
  await listen(page);
  const webm: `${string}.webm` = `${VIDEO}/tour.webm`;
  const recorder = await page.screencast({ path: webm });
  await wait(600);
  const strings: readonly (readonly [midi: number, offset: number])[] = [[40, -35], [45, 28], [50, -22], [55, 40]];
  for (const [midi, offset] of strings) {
    await page.evaluate(glideTone, hz(midi, offset), hz(midi), 1.6);
    await wait(2600);
  }
  await page.evaluate(setTone, 0);
  await wait(900);
  await recorder.stop();
  await page.close();
  const mp4 = join(VIDEO, 'tour.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'scale=720:-2', '-c:v', 'libx264',
    '-crf', '26', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', mp4]);
  rmSync(webm);
  console.log('  tour.mp4');
}

async function main(): Promise<void> {
  const app = siteFor('app');
  if (!existsSync(join(app.root, 'index.html'))) throw new Error('no web build — run `npm run build:web` first');
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(VIDEO, { recursive: true });
  const server = await serve(app, PORT);
  const browser = await launch({
    executablePath: CHROME,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--hide-scrollbars'],
  });
  const only = process.argv.slice(2);
  try {
    for (const [name, scene] of Object.entries(SCENES)) {
      if (only.length === 0 || only.includes(name)) await scene(browser);
    }
    if (only.length === 0 || only.includes('tour')) await tour(browser);
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
