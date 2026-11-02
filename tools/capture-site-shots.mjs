#!/usr/bin/env node
/**
 * The product site's screenshots and tour video, captured from the real web
 * build with the real pitch engine listening:
 *
 *     npm run build:web && npm run capture:shots
 *
 * Chrome runs headless against `dist/` (served as Vercel would, see
 * serve-web.mjs) at a phone's size. The microphone is replaced by an
 * oscillator bank playing a string-like harmonic series, so every reading on
 * screen — the note, the cents, the ticks — is what the engine actually made
 * of a tone, not a mock-up. Settings are written to storage before each load,
 * the same way the app reads them back.
 *
 * Needs Google Chrome (or CHROME_PATH) and ffmpeg for the video.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from 'puppeteer-core';

import { serve } from './serve-web.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'assets', 'screenshots');
const VIDEO = join(ROOT, 'docs', 'assets', 'video');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const PORT = 4174;
const ORIGIN = `http://localhost:${PORT}`;

/** A current iPhone's logical screen, captured 720 pixels wide like Ponticello's screenshots. */
const PHONE = { width: 402, height: 874, deviceScaleFactor: 720 / 402 };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1.25 };

/**
 * Installed before the page's own scripts: `getUserMedia` returns an
 * oscillator bank instead of a microphone. Harmonics are weighted like a
 * plucked string, so the engine faces a realistic spectrum.
 */
function installToneSource() {
  const weights = [1, 0.6, 0.4, 0.25, 0.15];
  window.__tone = { pending: 0 };
  navigator.mediaDevices.getUserMedia = async () => {
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
    window.__tone.set = (hz) => {
      const now = context.currentTime;
      oscillators.forEach(({ oscillator, harmonic }) => oscillator.frequency.setValueAtTime(hz * harmonic, now));
      master.gain.setTargetAtTime(hz > 0 ? 0.25 : 0, now, 0.01);
    };
    /** A peg being turned: glide from one pitch to another. */
    window.__tone.glide = (from, to, seconds) => {
      const now = context.currentTime;
      master.gain.setTargetAtTime(0.25, now, 0.01);
      oscillators.forEach(({ oscillator, harmonic }) => {
        oscillator.frequency.setValueAtTime(from * harmonic, now);
        oscillator.frequency.exponentialRampToValueAtTime(to * harmonic, now + seconds);
      });
    };
    if (window.__tone.pending) window.__tone.set(window.__tone.pending);
    return destination.stream;
  };
}

const hz = (midi, cents = 0, a4 = 440) => a4 * 2 ** ((midi - 69) / 12) * 2 ** (cents / 1200);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SETTINGS_KEY = 'pontifork/settings/v1';

function settings({ instrument = 'guitar', strings = 6, tuning = 'standard', a4 = 440 }) {
  const counts = { cello: 4, guitar: 6, bass: 4, [instrument]: strings };
  return { instrument, strings: counts, tunings: { [`${instrument}-${strings}`]: tuning }, a4 };
}

async function open(browser, { viewport = PHONE, scheme = 'light', path = '/', setup }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.evaluateOnNewDocument(installToneSource);
  await page.evaluateOnNewDocument((key, value) => localStorage.setItem(key, value), SETTINGS_KEY, JSON.stringify(settings(setup)));
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function listen(page) {
  await page.waitForSelector('[aria-label="Enable microphone"]');
  await page.click('[aria-label="Enable microphone"]');
  await page.waitForFunction(() => typeof window.__tone.set === 'function');
  // Clicking scrolled the button into view; put the tuner back at the top.
  await page.evaluate(() => document.querySelectorAll('div').forEach((el) => { el.scrollTop = 0; }));
}

/** Sounds `midi` at `cents` off for `ms`, as the engine will hear it. */
async function play(page, midi, { cents = 0, ms = 1300, a4 = 440 } = {}) {
  await page.evaluate((f) => window.__tone.set(f), hz(midi, cents, a4));
  await wait(ms);
}

async function tapString(page, numeral) {
  await page.click(`[aria-label^="String ${numeral},"]`);
}

async function shot(page, name, options = {}) {
  await wait(250);
  const path = join(SHOTS, `${name}.webp`);
  await page.screenshot({ path, type: 'webp', quality: 86, ...options });
  console.log(`  ${name}.webp`);
  await page.close();
}

/** Scrolls whichever scroll view holds the element with this exact text so the element sits near the top. */
async function scrollTo(page, text) {
  await page.evaluate((label) => {
    const target = [...document.querySelectorAll('div')].find((el) => el.textContent === label && el.children.length === 0);
    target?.scrollIntoView({ block: 'start' });
  }, text);
}

const SCENES = {
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
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollTo(page, 'Reference pitch');
    await play(page, 45, { a4: 442, ms: 700 });
    await shot(page, 'reference');
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
async function tour(browser) {
  const page = await open(browser, { setup: {} });
  await listen(page);
  const webm = join(VIDEO, 'tour.webm');
  const recorder = await page.screencast({ path: webm });
  const glide = (midi, fromCents, seconds) => page.evaluate((a, b, s) => window.__tone.glide(a, b, s), hz(midi, fromCents), hz(midi), seconds);
  await wait(600);
  for (const [midi, offset] of [[40, -35], [45, 28], [50, -22], [55, 40]]) {
    await glide(midi, offset, 1.6);
    await wait(2600);
  }
  await page.evaluate(() => window.__tone.set(0));
  await wait(900);
  await recorder.stop();
  await page.close();
  const mp4 = join(VIDEO, 'tour.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'scale=720:-2', '-c:v', 'libx264',
    '-crf', '26', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', mp4]);
  rmSync(webm);
  console.log('  tour.mp4');
}

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('no web build — run `npm run build:web` first');
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(VIDEO, { recursive: true });
  const server = await serve(PORT);
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
