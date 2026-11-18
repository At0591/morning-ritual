// Shortcuts into the phone's own settings for Morning Ritual.
import { Alert, Linking, Platform } from 'react-native';

/** Open Settings → Apps → Morning Ritual (Android) or the app's settings (iOS). */
export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    } else {
      await Linking.openURL('app-settings:');
    }
  } catch {
    Alert.alert('Could not open Settings', 'Please open Settings → Apps → Morning Ritual → Notifications manually.');
  }
}

/**
 * iQOO / Vivo / Xiaomi: there's no public intent for auto-start or battery
 * settings on these skins, so explain the toggles and open the app's page.
 */
export function showOemSetupGuide(): void {
  Alert.alert(
    'Make alarms fire on lock screen',
    "iQOO / Vivo / Xiaomi aggressively kill background apps. To make sure the alarm fires when your phone is locked:\n\n" +
      "1. Settings → Apps → Morning Ritual → Auto-launch → ON\n" +
      "2. Settings → Apps → Morning Ritual → Battery → Unrestricted / Don't optimize\n" +
      "3. Settings → Apps → Morning Ritual → Notifications → enable Ringtone\n\n" +
      "These are 3 quick toggles. Tap 'Open settings' to jump there now.",
    [
      { text: 'Open settings', onPress: () => void openAppSettings() },
      { text: 'Got it', style: 'cancel' },
    ]
  );
}
