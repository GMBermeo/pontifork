import { describe, expect, it } from 'vitest';

import { clampA4, DEFAULT_SETTINGS, sanitizeSettings } from '../settingsModel';

describe('sanitizeSettings', () => {
  it('keeps a valid stored copy as it is', () => {
    const stored = {
      instrument: 'guitar', strings: { cello: 4, guitar: 7, bass: 5 },
      tunings: { 'guitar-7': 'drop-a', 'bass-5': 'high-c' }, a4: 442,
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
      tunings: { 'bass-6': 'drop-a' }, a4: 440,
    });
  });
});

describe('clampA4', () => {
  it.each([[440, 440], [441.6, 442], [300, 415], [500, 466], [Number.NaN, 440]])('%f Hz is stored as %i', (hz, stored) => {
    expect(clampA4(hz)).toBe(stored);
  });
});
