import { describe, expect, it } from 'vitest';

import { clampA4, DEFAULT_BOOK, DEFAULT_SETTINGS, sanitizeBook, sanitizeSettings } from '../settingsModel';

describe('sanitizeSettings', () => {
  it('keeps a valid stored copy as it is', () => {
    const stored = {
      instrument: 'guitar', strings: { cello: 4, guitar: 7, bass: 5 },
      tunings: { 'guitar-7': 'drop-a', 'bass-5': 'high-c' }, a4: 442,
      book: { tab: 'key', key: '9-minor', labels: 'notes', allPositions: true, leftHanded: true, capo: 3, sound: false },
    };
    expect(sanitizeSettings(stored)).toEqual(stored);
  });

  it('falls back to the defaults for anything that is not settings', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('guitar')).toEqual(DEFAULT_SETTINGS);
  });

  it('drops what the catalogue no longer has', () => {
    const settings = sanitizeSettings({
      instrument: 'banjo', strings: { guitar: 12, bass: 6 },
      tunings: { 'guitar-6': 'open-banjo', 'bass-6': 'drop-a', 'bass-4': 'drop-d' }, a4: 'loud',
    });
    expect(settings).toEqual({
      instrument: 'cello', strings: { cello: 4, guitar: 6, bass: 6 },
      tunings: { 'bass-6': 'drop-a' }, a4: 440, book: DEFAULT_BOOK,
    });
  });
});

describe('sanitizeBook', () => {
  it('reads a copy written before the chord book existed as the defaults', () => {
    expect(sanitizeBook(undefined)).toEqual(DEFAULT_BOOK);
  });

  it('opens the key page only while a key is chosen', () => {
    expect(sanitizeBook({ tab: 'key', key: null }).tab).toBe('maj');
    expect(sanitizeBook({ tab: 'key', key: '0-major' }).tab).toBe('key');
  });

  it('drops an unknown type, key or label style, and keeps the capo on the neck', () => {
    expect(sanitizeBook({ tab: 'add11', key: '13-major', labels: 'colours', capo: 12 })).toEqual({
      ...DEFAULT_BOOK, capo: 7,
    });
  });
});

describe('clampA4', () => {
  it.each([[440, 440], [441.6, 442], [300, 415], [500, 466], [Number.NaN, 440]])('%f Hz is stored as %i', (hz, stored) => {
    expect(clampA4(hz)).toBe(stored);
  });
});
