#!/usr/bin/env node
/**
 * Serves a build the way Vercel will, so a deployment can be tried before it
 * exists:
 *
 *     npm run build:web && npm run preview:web   → the web app,  http://localhost:4173
 *     npm run preview:site                       → the product site, http://localhost:4174
 *
 * Each is its own Vercel project with its own `vercel.json`, applied here in
 * Vercel's order: redirects, then clean URLs, then the filesystem (a
 * directory serves its index.html), then rewrites, then `404.html`, with the
 * configured headers on every response. Only the rule shapes these two
 * configs use are understood.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');

interface Redirect {
  readonly source: RegExp;
  readonly destination: string;
  readonly permanent: boolean;
}

interface Rewrite {
  readonly source: RegExp;
  readonly destination: string;
}

interface HeaderRule {
  readonly source: RegExp;
  /** Hosts the rule is limited to, as patterns; empty for every host. */
  readonly hosts: readonly RegExp[];
  readonly headers: readonly (readonly [key: string, value: string])[];
}

export interface VercelConfig {
  readonly outputDirectory: string | null;
  readonly cleanUrls: boolean;
  readonly trailingSlash: boolean | null;
  readonly redirects: readonly Redirect[];
  readonly rewrites: readonly Rewrite[];
  readonly headers: readonly HeaderRule[];
}

export interface Site {
  readonly name: SiteName;
  /** The folder Vercel serves. */
  readonly root: string;
  readonly config: VercelConfig;
  /** Paths `.vercelignore` keeps out of the deployment, relative to `root`. */
  readonly ignored: readonly string[];
  readonly port: number;
}

export type SiteName = 'app' | 'site';

// ─── Reading vercel.json ─────────────────────────────────────────────────────

type Json = Readonly<Record<string, unknown>>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entries(value: unknown, what: string): Json[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${what} must be a list`);
  return value.map((item: unknown, index) => {
    if (!isJson(item)) throw new Error(`${what}[${index}] must be an object`);
    return item;
  });
}

function text(record: Json, key: string, what: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`${what}: "${key}" must be a string`);
  return value;
}

function flag(record: Json, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

const escapeRegExp = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A Vercel `source`: literal text with `(.*)`, `:name` and `:name*` segments. */
function compileSource(source: string): RegExp {
  const pattern = source.split(/(\(\.\*\)|:\w+\*?)/).map((token) => {
    if (token === '(.*)') return '(.*)';
    if (/^:\w+\*$/.test(token)) return `(?<${token.slice(1, -1)}>.*)`;
    if (/^:\w+$/.test(token)) return `(?<${token.slice(1)}>[^/]+)`;
    return escapeRegExp(token);
  }).join('');
  return new RegExp(`^${pattern}$`);
}

/** A destination with the source's `:name` and `$1` captures filled in. */
function fill(destination: string, match: RegExpExecArray): string {
  return destination.replace(/:(\w+)\*?|\$(\d)/g, (_whole: string, name: string | undefined, index: string | undefined) =>
    name === undefined ? match[Number(index)] ?? '' : match.groups?.[name] ?? '');
}

export function readVercelConfig(path: string): VercelConfig {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isJson(raw)) throw new Error(`${path} must hold an object`);
  const outputDirectory = raw['outputDirectory'];
  return {
    outputDirectory: typeof outputDirectory === 'string' ? outputDirectory : null,
    cleanUrls: flag(raw, 'cleanUrls') === true,
    trailingSlash: flag(raw, 'trailingSlash'),
    redirects: entries(raw['redirects'], 'redirects').map((rule) => ({
      source: compileSource(text(rule, 'source', 'redirect')),
      destination: text(rule, 'destination', 'redirect'),
      permanent: flag(rule, 'permanent') === true,
    })),
    rewrites: entries(raw['rewrites'], 'rewrites').map((rule) => ({
      source: compileSource(text(rule, 'source', 'rewrite')),
      destination: text(rule, 'destination', 'rewrite'),
    })),
    headers: entries(raw['headers'], 'headers').map((rule) => ({
      source: compileSource(text(rule, 'source', 'header rule')),
      hosts: entries(rule['has'], 'has')
        .filter((condition) => condition['type'] === 'host')
        .map((condition) => new RegExp(`^${text(condition, 'value', 'has')}$`)),
      headers: entries(rule['headers'], 'headers').map((header) =>
        [text(header, 'key', 'header'), text(header, 'value', 'header')] as const),
    })),
  };
}

// ─── The two deployments ─────────────────────────────────────────────────────

/** The entries of a `.vercelignore`, or none when there is no such file. */
function ignoredIn(folder: string): string[] {
  const file = join(folder, '.vercelignore');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));
}

export function siteFor(name: SiteName): Site {
  if (name === 'app') {
    const config = readVercelConfig(join(ROOT, 'vercel.json'));
    return { name, root: join(ROOT, config.outputDirectory ?? 'dist'), config, ignored: [], port: 4173 };
  }
  const root = join(ROOT, 'docs');
  return { name, root, config: readVercelConfig(join(root, 'vercel.json')), ignored: ignoredIn(root), port: 4174 };
}

// ─── Serving ─────────────────────────────────────────────────────────────────

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

/** The file a path names inside `root`: itself, its index.html, or (with clean URLs) its .html. */
function fileFor(site: Site, pathname: string): string | null {
  const path = normalize(join(site.root, decodeURIComponent(pathname)));
  if (path !== site.root && !path.startsWith(site.root + sep)) return null;
  const inside = path.slice(site.root.length + 1);
  // Not uploaded: what .vercelignore names, and dotfiles such as .vercelignore itself.
  if (inside.split(sep).some((part) => part.startsWith('.'))) return null;
  if (site.ignored.some((entry) => inside === entry || inside.startsWith(`${entry}${sep}`))) return null;
  const candidates = [path, join(path, 'index.html'), ...(site.config.cleanUrls ? [`${path}.html`] : [])];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Where Vercel would redirect this path before looking for a file, or null. */
function redirectFor(site: Site, pathname: string): { location: string; permanent: boolean } | null {
  for (const rule of site.config.redirects) {
    const match = rule.source.exec(pathname);
    if (match) return { location: fill(rule.destination, match), permanent: rule.permanent };
  }
  if (site.config.trailingSlash === false && pathname.length > 1 && pathname.endsWith('/')) {
    return { location: pathname.slice(0, -1), permanent: true };
  }
  if (site.config.cleanUrls && pathname.endsWith('.html')) {
    const clean = pathname.slice(0, -'.html'.length);
    return { location: clean.endsWith('/index') ? clean.slice(0, -'index'.length) : clean, permanent: true };
  }
  return null;
}

function applyHeaders(site: Site, request: IncomingMessage, pathname: string, response: ServerResponse): void {
  const host = request.headers.host ?? 'localhost';
  for (const rule of site.config.headers) {
    const forHost = rule.hosts.length === 0 || rule.hosts.some((pattern) => pattern.test(host));
    if (forHost && rule.source.test(pathname)) for (const [key, value] of rule.headers) response.setHeader(key, value);
  }
}

/** The file to answer with, and its status: itself, a rewrite's target, or the 404 page. */
function resolve(site: Site, pathname: string): { path: string; status: number } | null {
  const direct = fileFor(site, pathname);
  if (direct !== null) return { path: direct, status: 200 };
  for (const rule of site.config.rewrites) {
    const match = rule.source.exec(pathname);
    if (match) {
      const rewritten = fileFor(site, fill(rule.destination, match));
      return rewritten === null ? null : { path: rewritten, status: 200 };
    }
  }
  const notFound = fileFor(site, '/404.html');
  return notFound === null ? null : { path: notFound, status: 404 };
}

function respond(site: Site, request: IncomingMessage, response: ServerResponse): void {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  applyHeaders(site, request, pathname, response);

  const redirect = redirectFor(site, pathname);
  if (redirect) {
    response.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.location }).end();
    return;
  }

  const found = resolve(site, pathname);
  if (found === null) {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  response.writeHead(found.status, { 'Content-Type': TYPES[extname(found.path)] ?? 'application/octet-stream' });
  createReadStream(found.path).pipe(response);
}

export function serve(site: Site, port: number = site.port): Promise<Server> {
  const server = createServer((request, response) => {
    respond(site, request, response);
  });
  return new Promise((resolve) => server.listen(port, () => {
    resolve(server);
  }));
}

function isSiteName(value: string): value is SiteName {
  return value === 'app' || value === 'site';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? 'app';
  if (!isSiteName(name)) throw new Error(`serve-web: expected "app" or "site", got "${name}"`);
  const site = siteFor(name);
  if (!existsSync(join(site.root, 'index.html'))) {
    console.error(`✗ nothing to serve in ${site.root} — run \`npm run build:web\` first`);
    process.exit(1);
  }
  const port = Number(process.argv[3] ?? site.port);
  await serve(site, port);
  console.log(`Serving the ${name === 'app' ? 'web app' : 'product site'} from ${site.root} as Vercel would, on http://localhost:${port}`);
}
