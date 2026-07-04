// src/services/subscription.ts
// Subscription management via RevenueCat (react-native-purchases).
//
// CURRENT STATUS: IAP is DEFERRED to v1.0.1. react-native-purchases@latest
// broke EAS Build's "Install dependencies" phase (similar to the
// @notifee/react-native issue we hit earlier). To unblock shipping v1.0
// with the free tier, we've removed the package. When EAS supports
// react-native-purchases again (or we switch to expo-iap), re-install
// and remove the `isIapAvailable` guard.
//
// Setup checklist for production (steps to do when user creates Apple/Google accounts):
//  1. Reinstall: `npm install react-native-purchases --legacy-peer-deps`
//  2. Create app in App Store Connect + Google Play Console
//  3. Create IAP products:
//     - monthly: $3.99 USD
//     - yearly:  $29.99 USD
//  4. In RevenueCat dashboard (https://app.revenuecat.com/):
//     - Connect App Store + Google Play
//     - Create entitlement "premium"
//     - Attach both products to that entitlement
//     - Copy the API keys for each platform
//  5. Replace the REPLACE_WITH_* placeholders in app.json's `extra.revenueCat`
//  6. Set `isIapAvailable()` to return true (or remove the check)
//  7. Rebuild EAS

import { Platform } from 'react-native';
import Constants from 'expo-constants';

type RevenueCatConfig = {
  iosApiKey: string;
  androidApiKey: string;
  monthlyProductId: string;
  yearlyProductId: string;
  entitlementId: string;
};

function getConfig(): RevenueCatConfig {
  const extra = (Constants.expoConfig?.extra as any)?.revenueCat;
  if (!extra) {
    throw new Error(
      'revenueCat config missing from app.json. Add the extra.revenueCat block.'
    );
  }
  return extra;
}

function isMockMode(): boolean {
  const config = getConfig();
  if (Platform.OS === 'ios') return config.iosApiKey.includes('REPLACE');
  if (Platform.OS === 'android') return config.androidApiKey.includes('REPLACE');
  return true;
}

// Lazy-loaded RevenueCat module. We dynamic-import so the app doesn't crash
// on first launch when the native module isn't yet linked.
let Purchases: any = null;
async function getPurchases() {
  if (Purchases) return Purchases;
  try {
    // @ts-ignore — react-native-purchases is optional (see isIapAvailable)
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
    return Purchases;
  } catch (e) {
    console.warn('[subscription] react-native-purchases not available:', e);
    return null;
  }
}

let initialized = false;
let mockPremiumOverride = false;

/**
 * Initialize the subscription service. Call once on app start.
 * No-op in mock mode (no API key configured).
 */
export async function initSubscriptionService(): Promise<void> {
  if (initialized) return;
  if (isMockMode()) {
    console.log('[subscription] Running in MOCK mode (no RevenueCat API key).');
    initialized = true;
    return;
  }
  const config = getConfig();
  const RC = await getPurchases();
  if (!RC) return;
  const apiKey = Platform.OS === 'ios' ? config.iosApiKey : config.androidApiKey;
  try {
    RC.configure({ apiKey });
    initialized = true;
    console.log('[subscription] RevenueCat configured for', Platform.OS);
  } catch (e: any) {
    console.error('[subscription] Failed to configure RevenueCat:', e?.message ?? e);
  }
}

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'yearly' | null;

export type Offerings = {
  monthly: { priceString: string; price: number } | null;
  yearly: { priceString: string; price: number } | null;
};

/**
 * Check if the user currently has an active premium subscription.
 * In MOCK mode: returns false unless mockPremiumOverride is set via Settings.
 */
export async function getSubscriptionStatus(): Promise<{
  tier: SubscriptionTier;
  period: SubscriptionPeriod;
  expiresAt: Date | null;
}> {
  if (isMockMode()) {
    return {
      tier: mockPremiumOverride ? 'premium' : 'free',
      period: mockPremiumOverride ? 'monthly' : null,
      expiresAt: mockPremiumOverride ? new Date(Date.now() + 30 * 86400_000) : null,
    };
  }
  const RC = await getPurchases();
  if (!RC) return { tier: 'free', period: null, expiresAt: null };
  try {
    const customerInfo = await RC.getCustomerInfo();
    const config = getConfig();
    const entitlement = customerInfo.entitlements.active[config.entitlementId];
    if (!entitlement) {
      return { tier: 'free', period: null, expiresAt: null };
    }
    const isYearly = entitlement.productIdentifier === config.yearlyProductId;
    return {
      tier: 'premium',
      period: isYearly ? 'yearly' : 'monthly',
      expiresAt: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
    };
  } catch (e: any) {
    console.error('[subscription] getCustomerInfo failed:', e?.message ?? e);
    return { tier: 'free', period: null, expiresAt: null };
  }
}

/**
 * Fetch the available products with localized prices.
 * In MOCK mode, returns hardcoded prices.
 */
export async function getOfferings(): Promise<Offerings> {
  if (isMockMode()) {
    return {
      monthly: { priceString: '$3.99', price: 3.99 },
      yearly: { priceString: '$29.99', price: 29.99 },
    };
  }
  const RC = await getPurchases();
  if (!RC) return { monthly: null, yearly: null };
  try {
    const offerings = await RC.getOfferings();
    const config = getConfig();
    const current = offerings.current;
    if (!current) return { monthly: null, yearly: null };
    const monthly = current.monthly?.product;
    const yearly = current.annual?.product;
    return {
      monthly: monthly
        ? { priceString: monthly.priceString, price: monthly.price }
        : null,
      yearly: yearly
        ? { priceString: yearly.priceString, price: yearly.price }
        : null,
    };
  } catch (e: any) {
    console.error('[subscription] getOfferings failed:', e?.message ?? e);
    return { monthly: null, yearly: null };
  }
}

/**
 * Start a purchase for the given period. Returns the new subscription status.
 * In MOCK mode, this just enables the override flag.
 */
export async function purchaseSubscription(
  period: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; status: Awaited<ReturnType<typeof getSubscriptionStatus>> }> {
  if (isMockMode()) {
    mockPremiumOverride = true;
    return {
      success: true,
      status: await getSubscriptionStatus(),
    };
  }
  const RC = await getPurchases();
  if (!RC) return { success: false, error: 'RevenueCat not available', status: { tier: 'free', period: null, expiresAt: null } };
  try {
    const config = getConfig();
    const offerings = await RC.getOfferings();
    const current = offerings.current;
    if (!current) throw new Error('No offerings available');
    const product = period === 'monthly' ? current.monthly?.product : current.annual?.product;
    if (!product) throw new Error(`No ${period} product available`);

    // Note: making a purchase requires the app to be a real build (not Expo Go)
    // and the user must be signed into a sandbox/test account on iOS or have
    // test access on Google Play. The dev APK is fine for testing.
    const customerInfo = await RC.purchaseStoreProduct(product);
    const entitlement = customerInfo.customerInfo.entitlements.active[config.entitlementId];
    return {
      success: !!entitlement,
      status: await getSubscriptionStatus(),
    };
  } catch (e: any) {
    // User cancelled
    if (e?.userCancelled) {
      return { success: false, error: 'cancelled', status: await getSubscriptionStatus() };
    }
    console.error('[subscription] purchase failed:', e?.message ?? e);
    return { success: false, error: e?.message ?? 'Purchase failed', status: await getSubscriptionStatus() };
  }
}

/**
 * Restore previous purchases (e.g., when user gets a new device).
 */
export async function restorePurchases(): Promise<{ restored: boolean; status: Awaited<ReturnType<typeof getSubscriptionStatus>> }> {
  if (isMockMode()) {
    return { restored: mockPremiumOverride, status: await getSubscriptionStatus() };
  }
  const RC = await getPurchases();
  if (!RC) return { restored: false, status: { tier: 'free', period: null, expiresAt: null } };
  try {
    await RC.restorePurchases();
    return { restored: true, status: await getSubscriptionStatus() };
  } catch (e: any) {
    console.error('[subscription] restore failed:', e?.message ?? e);
    return { restored: false, status: { tier: 'free', period: null, expiresAt: null } };
  }
}

// Debug-only: for testing the premium UI without a real RevenueCat account
export function setMockPremiumOverride(enabled: boolean): void {
  mockPremiumOverride = enabled;
}
export function isMockModeActive(): boolean {
  return isMockMode();
}

/**
 * Returns true if real IAP is available. Currently false because
 * react-native-purchases was removed due to EAS Build incompatibility.
 * Re-enable by reinstalling the package and flipping this to true.
 */
export function isIapAvailable(): boolean {
  return true;
}
