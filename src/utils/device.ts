// Phone-brand quirks that change how the alarm reaches the lock screen.

/**
 * Brands whose Android skins are known to reject full-screen alarm
 * notifications even when allowed (confirmed on an iQOO Neo 10R, OriginOS 6),
 * so the ringer needs "Display over other apps" to open the wake-up screen.
 * Everywhere else (Pixel, Samsung, Motorola...) the full-screen alarm is
 * enough and we don't ask for the extra permission.
 */
const OVERLAY_FALLBACK_BRANDS = ['vivo', 'iqoo', 'xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'oneplus'];

export function needsOverlayFallback(manufacturer: string | null | undefined): boolean {
  if (!manufacturer) return false;
  const brand = manufacturer.trim().toLowerCase();
  return OVERLAY_FALLBACK_BRANDS.some((b) => brand === b || brand.startsWith(`${b} `));
}
