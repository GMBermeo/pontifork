#!/usr/bin/env node
/**
 * Neither the product site (`docs/`) nor the web app's page template
 * (`public/index.html`) has a build step that would notice when they break,
 * so this checks what a broken deploy, a bad link preview or a search engine
 * would show:
 *
 *     npm run check:site
 *
 * For each page:
 * - every local file it references (src, href, poster, srcset) exists;
 * - every image has alt text and a size, every video an accessible name;
 * - a title of at most 60 characters and a description of at most 160;
 * - the canonical address and og:url are the page's own, on its own domain
 *   (the web app sets them per route, so its template must not);
 * - the Open Graph and Twitter cards are complete, and the preview image is
 *   an absolute URL to a file that exists, at the size the tags say;
 * - the structured data parses, links only to the two real domains, names
 *   files that exist, and its how-to steps are the page's own;
 * - robots.txt points at the sitemap, and the sitemap lists the page, only
 *   addresses on its domain, files that exist and routes the app has.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { APP_URL, SITE_URL } from '../src/theme/brand.ts';

const ROOT = join(import.meta.dirname, '..');
const OUR_ORIGINS = [new URL(SITE_URL).origin, new URL(APP_URL).origin];

const TITLE_MAX = 60;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 160;

interface Page {
  readonly label: string;
  /** The HTML, relative to the repository. */
  readonly file: string;
  /** The folder deployed at `origin`. */
  readonly served: string;
  readonly origin: string;
  /** Where the page sits on its domain. */
  readonly path: `/${string}`;
  /** `static`: written in the HTML. `per-route`: written by the app as each route opens. */
  readonly canonical: 'static' | 'per-route';
  /** Expo fills these into the web app's template at export. */
  readonly placeholders: Readonly<Record<string, string>>;
}

const PAGES: readonly Page[] = [
  {
    label: 'product site', file: 'docs/index.html', served: 'docs', origin: SITE_URL, path: '/',
    canonical: 'static', placeholders: {},
  },
  {
    label: 'web app', file: 'public/index.html', served: 'public', origin: APP_URL, path: '/',
    canonical: 'per-route', placeholders: { '%WEB_TITLE%': 'Pontifork', '%LANG_ISO_CODE%': 'en' },
  },
];

/** Paths the web app's sitemap may list, and the route file each must have. */
const APP_ROUTES: Readonly<Record<string, string>> = {
  '/': 'src/app/(tabs)/index.tsx',
  '/chords': 'src/app/(tabs)/chords.tsx',
};

// ─── Reading HTML ────────────────────────────────────────────────────────────

type Attributes = ReadonlyMap<string, string>;

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'" };

function decode(value: string): string {
  return value.replace(/&(amp|quot|apos|lt|gt|#39);/g, (whole: string, name: string) => ENTITIES[name] ?? whole);
}

function attributesOf(tag: string): Attributes {
  const attributes = new Map<string, string>();
  for (const [, name, value] of tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)) {
    if (name !== undefined && value !== undefined) attributes.set(name.toLowerCase(), decode(value));
  }
  return attributes;
}

function tagsNamed(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(([tag]) => tag);
}

/** Every `content` of `<meta name=key>` or `<meta property=key>`. */
function metaValues(html: string, key: string): string[] {
  return tagsNamed(html, 'meta').map(attributesOf)
    .filter((attributes) => attributes.get('name') === key || attributes.get('property') === key)
    .map((attributes) => attributes.get('content') ?? '');
}

/** The text of an HTML fragment: tags dropped, whitespace collapsed. */
function textOf(html: string): string {
  let text = '';
  let inTag = false;
  for (const character of html) {
    if (character === '<') inTag = true;
    else if (character === '>') inTag = false;
    else if (!inTag) text += character;
  }
  return decode(text).split(/\s/).filter((word) => word !== '').join(' ');
}

// ─── Checks ──────────────────────────────────────────────────────────────────

class Report {
  readonly failures: string[] = [];

  fail(message: string): void {
    this.failures.push(message);
  }

  expect(condition: boolean, message: string): void {
    if (!condition) this.fail(message);
  }
}

/** The local file an address on `page`'s own domain is served from, or null for another domain. */
function localFile(page: Page, address: string): string | null {
  const url = new URL(address, `${page.origin}${page.path}`);
  if (url.origin !== new URL(page.origin).origin) return null;
  return join(ROOT, page.served, decodeURIComponent(url.pathname));
}

/** Width and height from a PNG's header, or null when the file is not a PNG. */
function pngSize(path: string): { width: number; height: number } | null {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(1, 4).toString('latin1');
  return signature === 'PNG' ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
}

/** Every local address the page loads or links to (src, href, poster, srcset), without query or fragment. */
function localReferences(html: string): Set<string> {
  const references = new Set<string>();
  for (const [, attribute, value] of html.matchAll(/\s(src|href|poster|srcset)="([^"]+)"/g)) {
    if (attribute === undefined || value === undefined) continue;
    const candidates = attribute === 'srcset' ? value.split(',').map((part) => part.trim().split(/\s/)[0] ?? '') : [value];
    for (const candidate of candidates) {
      if (candidate !== '' && !/^(https?:|mailto:|#|data:)/.test(candidate)) references.add(candidate.split(/[?#]/)[0] ?? candidate);
    }
  }
  return references;
}

function checkReferences(page: Page, html: string, report: Report): number {
  const references = localReferences(html);
  for (const reference of references) {
    const file = localFile(page, reference);
    if (file !== null && !existsSync(file)) report.fail(`missing file: ${relative(ROOT, file)}`);
  }

  for (const tag of tagsNamed(html, 'img')) {
    const attributes = attributesOf(tag);
    report.expect(attributes.has('alt'), `image without alt text: ${tag.slice(0, 90)}…`);
    report.expect(attributes.has('width') && attributes.has('height'), `image without a width and height (the layout jumps as it loads): ${tag.slice(0, 90)}…`);
  }
  for (const tag of tagsNamed(html, 'video')) {
    report.expect((attributesOf(tag).get('aria-label') ?? '') !== '', `video without an accessible name: ${tag.slice(0, 90)}…`);
  }
  return references.size;
}

function single(html: string, key: string, report: Report): string | null {
  const values = metaValues(html, key);
  if (values.length !== 1) {
    report.fail(`expected one "${key}" tag, found ${values.length}`);
    return null;
  }
  const [value = ''] = values;
  report.expect(value.trim() !== '', `"${key}" is empty`);
  return value;
}

function checkHead(page: Page, html: string, report: Report): void {
  const canonicalUrl = `${page.origin}${page.path}`;

  report.expect(/<html lang="[a-z]{2}(-[A-Z]{2})?"/.test(html), 'the <html> element has no language');
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  report.expect(title !== '', 'the page has no <title>');
  report.expect(title.length <= TITLE_MAX, `the title is ${title.length} characters; search results cut it at ${TITLE_MAX}: "${title}"`);

  const description = single(html, 'description', report) ?? '';
  report.expect(description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_MAX,
    `the description is ${description.length} characters; keep it between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX}`);

  const robots = single(html, 'robots', report) ?? '';
  report.expect(!robots.includes('noindex'), 'the page asks not to be indexed');

  const canonicals = tagsNamed(html, 'link').map(attributesOf).filter((attributes) => attributes.get('rel') === 'canonical');
  if (page.canonical === 'static') {
    report.expect(canonicals.length === 1 && canonicals[0]?.get('href') === canonicalUrl, `the canonical address must be ${canonicalUrl}`);
  } else {
    report.expect(canonicals.length === 0, 'the web app sets its canonical address per route (PageMeta); the template must not');
  }

  report.expect(single(html, 'og:url', report) === canonicalUrl, `og:url must be ${canonicalUrl}`);
  report.expect(single(html, 'og:type', report) === 'website', 'og:type must be "website"');
  for (const key of ['og:title', 'og:description', 'og:site_name', 'og:locale', 'og:image:alt', 'twitter:title', 'twitter:description', 'twitter:image:alt']) {
    single(html, key, report);
  }
  report.expect(single(html, 'twitter:card', report) === 'summary_large_image', 'twitter:card must be "summary_large_image"');

  const image = single(html, 'og:image', report);
  if (image === null) return;
  report.expect(image.startsWith(`${page.origin}/`), `og:image must be an absolute address on ${page.origin}: ${image}`);
  report.expect(single(html, 'twitter:image', report) === image, 'twitter:image must be the og:image');
  const file = localFile(page, image);
  if (file === null || !existsSync(file)) {
    report.fail(`og:image names a file that is not deployed: ${image}`);
    return;
  }
  const size = pngSize(file);
  report.expect(size !== null && String(size.width) === metaValues(html, 'og:image:width')[0]
    && String(size.height) === metaValues(html, 'og:image:height')[0], 'og:image:width and og:image:height must match the image');
}

/** Every string anywhere inside a JSON value. */
function* stringsIn(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const item of value) yield* stringsIn(item);
  else if (typeof value === 'object' && value !== null) for (const item of Object.values(value)) yield* stringsIn(item);
}

/** Every object anywhere inside a JSON value. */
function* objectsIn(value: unknown): Generator<Readonly<Record<string, unknown>>> {
  if (Array.isArray(value)) {
    for (const item of value) yield* objectsIn(item);
  } else if (typeof value === 'object' && value !== null) {
    const record: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
    yield record;
    for (const item of Object.values(record)) yield* objectsIn(item);
  }
}

function hasType(node: Readonly<Record<string, unknown>>, type: string): boolean {
  const declared = node['@type'];
  return declared === type || (Array.isArray(declared) && declared.includes(type));
}

/** Addresses on Pontifork's domains must be ones it serves, and files it names must be deployed. */
function checkStructuredLinks(page: Page, data: unknown, report: Report): void {
  for (const value of stringsIn(data)) {
    if (!/^https?:\/\/[^/]*pontifork/.test(value)) continue;
    const { origin } = new URL(value);
    report.expect(OUR_ORIGINS.includes(origin), `structured data links to an address Pontifork does not serve: ${value}`);
    const file = localFile(page, value);
    if (file !== null && extname(file) !== '' && !existsSync(file)) report.fail(`structured data names a file that is not deployed: ${value}`);
  }
}

/** A HowTo's steps must be the ones the page shows, in order. */
function checkHowTo(html: string, data: unknown, report: Report): void {
  for (const howTo of [...objectsIn(data)].filter((node) => hasType(node, 'HowTo'))) {
    const steps: unknown = howTo['step'];
    const named = [...objectsIn(steps)].filter((node) => hasType(node, 'HowToStep')).map((node) => String(node['name']));
    const list = /<ol class="steps">([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? '';
    const onPage = [...list.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(([, heading]) => textOf(heading ?? ''));
    report.expect(named.join(' | ') === onPage.join(' | '), `the HowTo steps (${named.join(', ')}) are not the page's own (${onPage.join(', ')})`);
  }
}

function parseJson(block: string, report: Report): unknown {
  try {
    return JSON.parse(block);
  } catch (error) {
    report.fail(`structured data does not parse: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function checkStructuredData(page: Page, html: string, report: Report): number {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => json ?? '');
  report.expect(blocks.length > 0, 'no structured data (application/ld+json)');
  for (const block of blocks) {
    const data = parseJson(block, report);
    if (data === undefined) continue;
    const [top] = objectsIn(data);
    report.expect(top?.['@context'] === 'https://schema.org', 'structured data must declare "@context": "https://schema.org"');
    checkStructuredLinks(page, data, report);
    checkHowTo(html, data, report);
  }
  return blocks.length;
}

function extname(path: string): string {
  return /\.[a-z0-9]+$/i.exec(path)?.[0] ?? '';
}

function checkCrawling(page: Page, report: Report): number {
  const robotsFile = join(ROOT, page.served, 'robots.txt');
  const sitemapFile = join(ROOT, page.served, 'sitemap.xml');
  if (!existsSync(robotsFile) || !existsSync(sitemapFile)) {
    report.fail(`${page.served}/ needs a robots.txt and a sitemap.xml`);
    return 0;
  }
  const robots = readFileSync(robotsFile, 'utf8');
  report.expect(robots.includes(`Sitemap: ${page.origin}/sitemap.xml`), `robots.txt must point at ${page.origin}/sitemap.xml`);
  report.expect(!/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt shuts every crawler out');

  const sitemap = readFileSync(sitemapFile, 'utf8');
  report.expect(sitemap.startsWith('<?xml') && sitemap.trimEnd().endsWith('</urlset>'), 'sitemap.xml is not a <urlset> document');
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, address]) => address ?? '');
  const files = [...sitemap.matchAll(/<(?:image:loc|video:content_loc|video:thumbnail_loc)>([^<]+)</g)].map(([, address]) => address ?? '');
  report.expect(pages.includes(`${page.origin}${page.path}`), `the sitemap does not list ${page.origin}${page.path}`);
  for (const address of [...pages, ...files]) {
    report.expect(address.startsWith(`${page.origin}/`), `the sitemap lists an address on another domain: ${address}`);
  }
  for (const address of files) {
    const file = localFile(page, address);
    if (file === null || !existsSync(file)) report.fail(`the sitemap names a file that is not deployed: ${address}`);
  }
  if (page.canonical === 'per-route') {
    for (const address of pages) {
      const route = APP_ROUTES[new URL(address).pathname];
      report.expect(route !== undefined && existsSync(join(ROOT, route)), `the sitemap lists ${address}, which is not a route the app has`);
    }
  }
  return pages.length;
}

/** The site's 404 page: its own files resolve, and search engines are told to skip it. */
function checkNotFound(report: Report): void {
  const file = join(ROOT, 'docs', '404.html');
  if (!existsSync(file)) {
    report.fail('docs/ has no 404.html');
    return;
  }
  const html = readFileSync(file, 'utf8');
  report.expect(metaValues(html, 'robots').some((value) => value.includes('noindex')), '404.html must be noindex');
  const notFound: Page = { label: '404', file: 'docs/404.html', served: 'docs', origin: SITE_URL, path: '/', canonical: 'static', placeholders: {} };
  checkReferences(notFound, html, report);
}

let failed = false;
for (const page of PAGES) {
  const report = new Report();
  let html = readFileSync(join(ROOT, page.file), 'utf8');
  for (const [placeholder, value] of Object.entries(page.placeholders)) html = html.replaceAll(placeholder, value);

  const references = checkReferences(page, html, report);
  checkHead(page, html, report);
  const structured = checkStructuredData(page, html, report);
  const listed = checkCrawling(page, report);
  if (page.canonical === 'static') {
    const headings = tagsNamed(html, 'h1').length;
    report.expect(headings === 1, `a page needs exactly one <h1>; this one has ${headings}`);
    checkNotFound(report);
  }

  if (report.failures.length > 0) {
    failed = true;
    console.error(`✗ ${page.label} (${page.file}):\n  - ${report.failures.join('\n  - ')}`);
  } else {
    console.log(`✓ ${page.label} (${page.origin}): ${references} local references resolve, images and videos are labelled, `
      + `head and cards complete, ${structured} structured-data block(s), ${listed} page(s) in the sitemap.`);
  }
}
if (failed) process.exit(1);
