#!/usr/bin/env node
/**
 * Puts the product site beside the web app, so one Vercel deployment serves
 * the tuner at `/` and the site at `/docs/`.
 *
 *     node tools/bundle-docs.mjs [out-dir]     (default: dist)
 *
 * Runs after `expo export`. Copies only what the site publishes — the same
 * files `docs/.vercelignore` lets through when `docs/` is deployed on its own.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'docs');
const OUT = join(ROOT, process.argv[2] ?? 'dist', 'docs');

const ignored = readFileSync(join(SITE, '.vercelignore'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const isIgnored = (path) => ignored.some((pattern) => path === pattern || path.startsWith(`${pattern}/`));

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('✗ no web export in dist/ — run `npx expo export --platform web` first');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SITE, OUT, {
  recursive: true,
  filter: (source) => {
    const path = relative(SITE, source);
    return path === '' || !(isIgnored(path) || path.split('/').some((part) => part.startsWith('.')));
  },
});
console.log(`✓ product site copied to ${relative(ROOT, OUT)}/`);
