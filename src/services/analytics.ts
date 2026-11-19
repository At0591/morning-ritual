// Anonymous usage analytics (PostHog), strictly opt-in.
//
// Rules (GDPR / UK GDPR, US state privacy laws incl. Washington's My Health
// My Data Act):
//   - Nothing is sent unless the user said yes (setting 'analytics_consent').
//   - Never send journal text, notes, moods or any free text. sanitizeProperties
//     enforces this even if a caller slips up.
//   - No key configured = no analytics at all.
import PostHog from 'posthog-react-native';

// Akshay adds the real key (EU host) before launch; the placeholder disables analytics.
const POSTHOG_API_KEY = 'phc_dummy_key_for_now';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const ANALYTICS_CONSENT_KEY = 'analytics_consent';
export type AnalyticsConsent = 'granted' | 'denied' | null;

let posthogClient: PostHog | null = null;
type EventProperties = Parameters<PostHog['capture']>[1];
type SafeValue = string | number | boolean | null;

const BLOCKED_KEY = /text|line|journal|note|mood|feel|message|name|email/i;
const MAX_STRING = 40;

/**
 * Keep only short, non-personal values: numbers, booleans and short labels
 * (theme names, sources). Anything that could be the user's own words is dropped.
 */
export function sanitizeProperties(props: Record<string, unknown> | undefined): Record<string, SafeValue> {
  const out: Record<string, SafeValue> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_KEY.test(key)) continue;
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
    // Short labels only: anything with a space could be a sentence the user wrote.
    else if (typeof value === 'string' && value.length <= MAX_STRING && !/\s/.test(value)) out[key] = value;
  }
  return out;
}

function hasRealKey(): boolean {
  return POSTHOG_API_KEY.startsWith('phc_') && !POSTHOG_API_KEY.includes('dummy');
}

/** Start analytics only if the user opted in and a real key is configured. */
export async function initAnalytics(consent: AnalyticsConsent) {
  if (posthogClient || consent !== 'granted' || !hasRealKey()) return;
  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
    });
    console.log('[analytics] PostHog initialized (user opted in)');
  } catch (error) {
    console.warn('[analytics] Failed to initialize PostHog:', error);
  }
}

/** Turn analytics off now (the user withdrew consent). */
export async function stopAnalytics() {
  const client = posthogClient;
  posthogClient = null;
  try {
    await client?.optOut();
    await client?.reset();
  } catch {
    // Already stopped.
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!posthogClient) return;
  try {
    posthogClient.capture(eventName, sanitizeProperties(properties) as EventProperties);
    console.log(`[analytics] Tracked: ${eventName}`, properties || '');
  } catch (error) {
    console.warn(`[analytics] Failed to track ${eventName}:`, error);
  }
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!posthogClient) return;
  try {
    posthogClient.identify(userId, sanitizeProperties(properties) as EventProperties);
  } catch (error) {
    console.warn('[analytics] Failed to identify user:', error);
  }
}

// --- Funnel specific strongly typed tracking ---

export function trackOnboardingStart() {
  trackEvent('Onboarding_Start');
}

export function trackOnboardingComplete(properties: { selectedTheme: string; alarmTime: string }) {
  trackEvent('Onboarding_Complete', properties);
}

export function trackAlarmScheduled(properties: { time: string; taskTheme: string; smartWakeWindow: number }) {
  trackEvent('Alarm_Scheduled', properties);
}

export function trackAlarmFired(properties: { taskId: string; source: 'native' | 'js_timer' | 'js_background' }) {
  trackEvent('Alarm_Fired', properties);
}

export function trackTaskRevealed(properties: { taskTheme: string }) {
  trackEvent('Task_Revealed', properties);
}

export function trackTaskSnoozed(properties: { taskTheme: string; snoozeDurationMins: number }) {
  trackEvent('Task_Snoozed', properties);
}

export function trackTaskSkipped(properties: { taskTheme: string }) {
  trackEvent('Task_Skipped', properties);
}

export function trackVerificationStart(properties: { taskTheme: string; verificationMode: string }) {
  trackEvent('Verification_Start', properties);
}

export function trackTaskCompleted(properties: { taskTheme: string; verificationMode: string }) {
  trackEvent('Task_Completed', properties);
}

export function trackPremiumPromptShown(properties: { source: string }) {
  trackEvent('Premium_Prompt_Shown', properties);
}

export function trackPremiumSubscribed(properties: { tier: string }) {
  trackEvent('Premium_Subscribed', properties);
}
