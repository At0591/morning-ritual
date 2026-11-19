// Shortcuts into the phone's own settings for KindRise.
import { Alert, Linking, Platform } from 'react-native';

/** Open Settings → Apps → KindRise (Android) or the app's settings (iOS). */
export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    } else {
      await Linking.openURL('app-settings:');
    }
  } catch {
    Alert.alert('Could not open Settings', 'Please open Settings → Apps → KindRise → Notifications manually.');
  }
}

/**
 * iQOO / Vivo / Xiaomi: there's no public intent for auto-start or battery
 * settings on these skins, so explain the toggles and open the app's page.
 */
export function showOemSetupGuide(): void {
  Alert.alert(
    'Keep your alarm ringing when the phone is locked',
    "iQOO, Vivo and Xiaomi phones close background apps to save battery. To make sure your alarm rings when the phone is locked:\n\n" +
      "1. Settings → Apps → KindRise → Auto-launch → ON\n" +
      "2. Settings → Apps → KindRise → Battery → Unrestricted / Don't optimize\n" +
      "3. Settings → Apps → KindRise → Notifications → enable Ringtone\n\n" +
      "Tap 'Open settings' to go there now.",
    [
      { text: 'Open settings', onPress: () => void openAppSettings() },
      { text: 'Got it', style: 'cancel' },
    ]
  );
}
