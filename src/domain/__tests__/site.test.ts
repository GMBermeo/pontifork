import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { INSTRUMENT_ORDER, INSTRUMENTS, type InstrumentId } from '../instruments';
import { noteLetter } from '../pitch';
import { groupByFamily, setupKey, TUNING_FAMILY_LABEL, tuningsFor } from '../tunings';

/**
 * The product site lists every tuning (docs/index.html, #tunings). It is
 * static HTML with no build step, so this renders that list from the
 * catalogue and fails when the page differs.
 *
 *     npm run site:tunings      rewrites the list from the catalogue
 */
const PAGE = join(__dirname, '../../../docs/index.html');
const START = '<!-- tunings:start -->\n';
const END = '<!-- tunings:end -->';

function setupHtml(instrument: InstrumentId, strings: number): string[] {
  const key = setupKey(instrument, strings);
  const { name, stringCounts } = INSTRUMENTS[instrument];
  const title = stringCounts.length > 1 ? `${name} · ${strings} strings` : name;
  const lines = [
    `        <article class="setup" id="setup-${key}" aria-labelledby="setup-${key}-title">`,
    `          <h3 id="setup-${key}-title">${title}</h3>`,
  ];
  for (const group of groupByFamily(tuningsFor(instrument, strings))) {
    lines.push(`          <p class="family">${TUNING_FAMILY_LABEL[group.family]}</p>`, '          <ul>');
    for (const tuning of group.tunings) {
      const notes = tuning.notes.map((midi) => noteLetter(midi, tuning.spelling)).join(' ');
      lines.push(`            <li><span class="name">${tuning.name}</span><span class="notes">${notes}</span></li>`);
    }
    lines.push('          </ul>');
  }
  lines.push('        </article>');
  return lines;
}

/** The catalogue as the page lists it. */
export function renderCatalogue(): string {
  const lines = INSTRUMENT_ORDER.flatMap((instrument) =>
    INSTRUMENTS[instrument].stringCounts.flatMap((strings) => setupHtml(instrument, strings)));
  return `${lines.join('\n')}\n`;
}

function listedOnPage(page: string): string {
  const start = page.indexOf(START);
  const end = page.indexOf(END);
  if (start < 0 || end < start) throw new Error(`docs/index.html has no ${START.trim()} … ${END} markers`);
  return page.slice(start + START.length, end);
}

describe('the product site', () => {
  it('lists exactly the tunings the app offers', () => {
    expect(listedOnPage(readFileSync(PAGE, 'utf8'))).toBe(renderCatalogue());
  });

  it.runIf(process.env.WRITE_SITE_TUNINGS === '1')('rewrites the list from the catalogue', () => {
    const page = readFileSync(PAGE, 'utf8');
    const listed = listedOnPage(page);
    writeFileSync(PAGE, page.replace(`${START}${listed}${END}`, `${START}${renderCatalogue()}${END}`));
  });
});
