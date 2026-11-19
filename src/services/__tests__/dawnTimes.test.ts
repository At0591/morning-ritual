import { dawnTimesFor, roundCoordinate } from '../dawnTimes';

// Compare in UTC so the test doesn't depend on the machine's time zone.
const utcMinutes = (d: Date | null) => (d ? d.getUTCHours() * 60 + d.getUTCMinutes() : NaN);
const hm = (h: number, m: number) => h * 60 + m;

test('London, 21 Jun 2026 matches Drik Panchang (03:44–04:14 BST)', () => {
  const t = dawnTimesFor(new Date(Date.UTC(2026, 5, 21, 11, 0)), 51.5074, -0.1278);
  // BST is UTC+1.
  expect(Math.abs(utcMinutes(t.brahmaStart) - hm(2, 44))).toBeLessThanOrEqual(2);
  expect(Math.abs(utcMinutes(t.brahmaEnd) - hm(3, 14))).toBeLessThanOrEqual(2);
  expect(Math.abs(utcMinutes(t.sunrise) - hm(3, 43))).toBeLessThanOrEqual(2);
});

test('Mumbai, 18 Nov 2026 matches Drik Panchang (05:05–05:56 IST)', () => {
  const t = dawnTimesFor(new Date(Date.UTC(2026, 10, 18, 6, 30)), 19.076, 72.8777);
  // IST is UTC+5:30, so 05:05 IST is 23:35 UTC the day before.
  expect(Math.abs(utcMinutes(t.brahmaStart) - hm(23, 35))).toBeLessThanOrEqual(2);
  expect(Math.abs(utcMinutes(t.brahmaEnd) - hm(0, 26))).toBeLessThanOrEqual(2);
});

test('bedtime leaves 7 hours before Brahma Muhurta', () => {
  const t = dawnTimesFor(new Date(Date.UTC(2026, 5, 21, 11, 0)), 51.5074, -0.1278);
  expect(t.brahmaStart!.getTime() - t.bedtimeFor7h!.getTime()).toBe(7 * 60 * 60 * 1000);
});

test('no sunrise in Tromsø in December: no times, no crash', () => {
  const t = dawnTimesFor(new Date(Date.UTC(2026, 11, 15, 11, 0)), 69.6496, 18.956);
  expect(t.sunrise).toBeNull();
  expect(t.brahmaStart).toBeNull();
});

test('coordinates are rounded to about 1 km', () => {
  expect(roundCoordinate(51.507412)).toBe(51.51);
  expect(roundCoordinate(-0.127812)).toBe(-0.13);
});
