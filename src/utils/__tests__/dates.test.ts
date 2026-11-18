import { splitClock } from '../dates';
import { GOOD_THING_PROMPTS, suggestionsFor, sunPosition, SUN_TAPS_NEEDED } from '../../services/morningFlow';
import sourcesJson from '../../data/sources.json';

describe('splitClock', () => {
  const late = new Date(2026, 10, 18, 16, 55);

  test('12-hour locale: number and AM/PM are separate', () => {
    expect(splitClock(late, 'en-US')).toEqual({ time: '4:55', suffix: 'PM' });
  });

  test('24-hour locale: no suffix', () => {
    expect(splitClock(late, 'en-GB')).toEqual({ time: '16:55', suffix: '' });
  });
});

describe('morning flow helpers', () => {
  test('suggestions are three, stable within a day and change the next day', () => {
    const a = suggestionsFor(new Date(2026, 10, 18, 6, 0));
    expect(a).toHaveLength(3);
    expect(suggestionsFor(new Date(2026, 10, 18, 21, 0))).toEqual(a);
    expect(suggestionsFor(new Date(2026, 10, 19, 6, 0))).not.toEqual(a);
  });

  test('the sun starts low, rises with each tap and stays inside the field', () => {
    const start = sunPosition(0, 400, 800, 0.5);
    const end = sunPosition(SUN_TAPS_NEEDED - 1, 400, 800, 1);
    expect(end.top).toBeLessThan(start.top);
    expect(end.left).toBeLessThanOrEqual(400 - 92);
    expect(sunPosition(0, 50, 50, 1)).toEqual({ left: 0, top: 0 });
  });
});

test('every step-3 prompt has a starter and a real source', () => {
  const sources = sourcesJson as Record<string, { url: string }>;
  for (const p of GOOD_THING_PROMPTS) {
    expect(p.starter.trim().length).toBeGreaterThan(3);
    expect(sources[p.source]?.url).toMatch(/^https:\/\//);
  }
});
