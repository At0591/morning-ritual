// "I can't do this today": an accessible way out of the wake check. Press and
// hold to turn the alarm off; the 10-minute "Still up?" still runs. Screen
// reader users get a direct action instead of the hold.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityActionEvent, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { brand, fonts } from '../../theme';

const HOLD_MS = 2000;
const STEP_MS = 50;

interface Props {
  onTurnOff: () => void;
  onBack: () => void;
}

export function CantDoScreen({ onTurnOff, onBack }: Props) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      back.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, [onBack]);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + STEP_MS / HOLD_MS);
        if (next >= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setTimeout(onTurnOff, 0);
        }
        return next;
      });
    }, STEP_MS);
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress((p) => (p >= 1 ? p : 0));
  };

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' || e.nativeEvent.actionName === 'longpress') onTurnOff();
  };

  return (
    <View style={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      <StatusBar style="light" />
      <Text style={styles.title}>That's fine.</Text>
      <Text style={styles.body}>Press and hold the circle to turn the alarm off. We'll still check in with you in 10 minutes.</Text>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        style={styles.ring}
        accessibilityRole="button"
        accessibilityLabel="Turn off the alarm"
        accessibilityHint="Press and hold for two seconds"
        accessibilityActions={[{ name: 'activate' }, { name: 'longpress' }]}
        onAccessibilityAction={onAction}
      >
        <View style={[styles.fill, { height: `${Math.round(progress * 100)}%` }]} />
        <View style={styles.inner}>
          <Text style={styles.hold}>{progress > 0 ? 'Keep holding' : 'Hold'}</Text>
        </View>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable onPress={onBack} style={styles.back} accessibilityRole="button">
        <Text style={styles.backText}>Back to the sun tap</Text>
      </Pressable>
    </View>
  );
}

const SIZE = 190;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.night, paddingTop: 72, paddingBottom: 32, paddingHorizontal: 24, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, color: brand.white },
  body: { fontFamily: fonts.read, fontSize: 17, lineHeight: 24, color: brand.mist, textAlign: 'center', marginTop: 10 },
  ring: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, marginTop: 44, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: brand.amber },
  inner: { width: SIZE - 30, height: SIZE - 30, borderRadius: (SIZE - 30) / 2, backgroundColor: brand.night, justifyContent: 'center', alignItems: 'center' },
  hold: { fontFamily: fonts.readBold, fontSize: 18, color: brand.white },
  spacer: { flex: 1 },
  back: { alignSelf: 'stretch', minHeight: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.readBold, fontSize: 17, color: brand.white },
});
