jest.mock('posthog-react-native', () => jest.fn());

import { sanitizeProperties } from '../analytics';

test('keeps numbers, booleans and short labels', () => {
  expect(sanitizeProperties({ taskTheme: 'mind', minutes: 5, ok: true, source: 'native' })).toEqual({
    taskTheme: 'mind',
    minutes: 5,
    ok: true,
    source: 'native',
  });
});

test('never passes on journal text, notes or anything sentence-like', () => {
  const out = sanitizeProperties({
    text: "I'm grateful for my coffee",
    journalLine: 'x',
    note: 'y',
    mood: 'sad',
    theme: 'something the user typed in full',
    long: 'x'.repeat(60),
  });
  expect(out).toEqual({});
});
