// Tracks the two Android permissions that let a ringing alarm open the wake
// screen over the lock screen, and re-checks them whenever the user returns
// to the app (for example from the system settings page).
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  canOpenWakeScreenOverLockScreen,
  canShowFullScreenAlarm,
  openDisplayOverAppsSettings,
  openFullScreenAlarmSettings,
} from '../services/alarm';

export type LockScreenAccess = { fullScreen: boolean; overlay: boolean };

export function useLockScreenAccess() {
  // Android 14+: may the alarm notification open full screen?
  const [fullScreenOk, setFullScreenOk] = useState(true);
  // "Display over other apps": the route that works on OriginOS and MIUI.
  const [overlayOk, setOverlayOk] = useState(true);

  const refresh = useCallback(async (): Promise<LockScreenAccess> => {
    const [fullScreen, overlay] = await Promise.all([
      canShowFullScreenAlarm(),
      canOpenWakeScreenOverLockScreen(),
    ]);
    setFullScreenOk(fullScreen);
    setOverlayOk(overlay);
    return { fullScreen, overlay };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Send the user to whichever permission is still missing.
  const fix = useCallback(async () => {
    if (!overlayOk) await openDisplayOverAppsSettings();
    else await openFullScreenAlarmSettings();
  }, [overlayOk]);

  return { fullScreenOk, overlayOk, missing: !fullScreenOk || !overlayOk, refresh, fix };
}
