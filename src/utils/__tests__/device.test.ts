import { needsOverlayFallback } from '../device';

test('brands that reject full-screen alarms need the overlay fallback', () => {
  for (const brand of ['vivo', 'iQOO', 'Xiaomi', 'Redmi', 'OPPO', 'realme', 'OnePlus']) {
    expect(needsOverlayFallback(brand)).toBe(true);
  }
});

test('Pixel, Samsung and unknown phones are not asked for it', () => {
  for (const brand of ['Google', 'samsung', 'motorola', 'Nothing', '', null, undefined]) {
    expect(needsOverlayFallback(brand)).toBe(false);
  }
});
