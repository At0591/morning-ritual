import PostHog from 'posthog-react-native';

// TODO: Replace with the actual API key provided by the user
const POSTHOG_API_KEY = 'phc_dummy_key_for_now';
// Use the US or EU host depending on your PostHog instance
const POSTHOG_HOST = 'https://us.i.posthog.com';

let posthogClient: any = null;

export async function initAnalytics() {
  if (posthogClient) return;

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureApplicationLifecycleEvents: true,
      captureLifecycleEvents: true,
    });
    console.log('[analytics] PostHog initialized');
  } catch (error) {
    console.warn('[analytics] Failed to initialize PostHog:', error);
  }
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!posthogClient) return;
  try {
    posthogClient.capture(eventName, properties);
    console.log(`[analytics] Tracked: ${eventName}`, properties || '');
  } catch (error) {
    console.warn(`[analytics] Failed to track ${eventName}:`, error);
  }
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!posthogClient) return;
  try {
    posthogClient.identify(userId, properties);
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
