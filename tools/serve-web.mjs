#!/usr/bin/env node
/**
 * Serves the web build the way Vercel will, so a deployment can be tried
 * before it exists:
 *
 *     npm run build:web && npm run preview:web      → http://localhost:4173
 *
 * It reads `vercel.json` and applies it in Vercel's order — redirects, then
 * the filesystem (a directory serves its index.html), then rewrites — with the
 * configured headers. Only the rule shapes this project uses are understood.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const OUT = join(ROOT, config.outputDirectory ?? 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.map': 'application/json',
};

const escape = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vercel's `source` patterns, as used here: `(.*)` wildcards between literal text. */
const matcher = (source) => new RegExp(`^${source.split('(.*)').map(escape).join('(.*)')}$`);

function file(pathname) {
  const path = normalize(join(OUT, decodeURIComponent(pathname)));
  if (!path.startsWith(OUT)) return null;
  if (existsSync(path) && statSync(path).isFile()) return path;
  const index = join(path, 'index.html');
  return existsSync(index) ? index : null;
}

export function serve(port = 4173) {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    for (const { source, headers } of config.headers ?? []) {
      if (matcher(source).test(pathname)) for (const { key, value } of headers) response.setHeader(key, value);
    }
    const redirect = (config.redirects ?? []).find(({ source }) => matcher(source).test(pathname));
    if (redirect) {
      response.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination }).end();
      return;
    }
    let path = file(pathname);
    if (!path) {
      const rewrite = (config.rewrites ?? []).find(({ source }) => matcher(source).test(pathname));
      path = rewrite ? file(rewrite.destination) : null;
    }
    if (!path) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    createReadStream(path).pipe(response);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(OUT, 'index.html'))) {
    console.error('✗ nothing to serve — run `npm run build:web` first');
    process.exit(1);
  }
  const port = Number(process.argv[2] ?? 4173);
  await serve(port);
  console.log(`Serving ${OUT} as Vercel would, on http://localhost:${port}`);
}
