// Step 2: the wake check. Tap the sun five times; it rises a little each tap.
// Slow never fails. If the screen is left alone for a while the tone rises
// again, so falling back asleep here doesn't silence the alarm.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { setAlarmQuiet } from '../../services/alarm';
import { SUN_SIZE, SUN_TAPS_NEEDED, sunPosition } from '../../services/morningFlow';
import { brand, fonts } from '../../theme';

const IDLE_MS = 45_000;

interface Props {
  onDone: () => void;
  onCantDo: () => void;
}

export function SunTapScreen({ onDone, onCantDo }: Props) {
  const [taps, setTaps] = useState(0);
  const [field, setField] = useState({ width: 0, height: 0 });
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [nudge, setNudge] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const armIdle = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      // Left alone: let the tone rise again and say so.
      setAlarmQuiet(false);
      setNudge(true);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    setAlarmQuiet(true);
    armIdle();
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      if (idle.current) clearTimeout(idle.current);
      back.remove();
    };
  }, [armIdle]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setField({ width, height });
    setPos(sunPosition(0, width, height, Math.random()));
  };

  const tap = () => {
    const next = taps + 1;
    setTaps(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (nudge) {
      setNudge(false);
      setAlarmQuiet(true);
    }
    if (next >= SUN_TAPS_NEEDED) {
      if (idle.current) clearTimeout(idle.current);
      setTimeout(onDone, 300);
      return;
    }
    armIdle();
    setPos(sunPosition(next, field.width, field.height, Math.random()));
  };

  return (
    <View style={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      <StatusBar style="light" />
      <Text style={styles.title}>{nudge ? 'Still there? Tap the sun.' : 'Tap the sun'}</Text>
      <Text style={styles.sub}>Tap the sun five times, as slowly as you like.</Text>
      <View style={styles.field} onLayout={onLayout}>
        {field.width > 0 ? (
          <Pressable
            onPress={tap}
            style={[styles.sun, { left: pos.left, top: pos.top }]}
            accessibilityRole="button"
            accessibilityLabel={`Sun. Tap it. ${taps} of ${SUN_TAPS_NEEDED} taps done.`}
            hitSlop={16}
          />
        ) : null}
      </View>
      <View style={styles.dots} accessibilityLabel={`${taps} of ${SUN_TAPS_NEEDED}`}>
        {Array.from({ length: SUN_TAPS_NEEDED }, (_, i) => (
          <View key={i} style={[styles.dot, i < taps && styles.dotOn]} />
        ))}
      </View>
      <Pressable onPress={onCantDo} style={styles.cant} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.cantText}>I can't do this today</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.night, paddingTop: 72, paddingBottom: 32, paddingHorizontal: 24 },
  title: { fontFamily: fonts.display, fontSize: 30, color: brand.white, textAlign: 'center' },
  sub: { fontFamily: fonts.read, fontSize: 16, color: brand.mist, textAlign: 'center', marginTop: 6 },
  field: { flex: 1, marginVertical: 16 },
  sun: {
    position: 'absolute', width: SUN_SIZE, height: SUN_SIZE, borderRadius: SUN_SIZE / 2,
    backgroundColor: brand.amber, shadowColor: brand.amber, shadowOpacity: 0.8, shadowRadius: 24, elevation: 12,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { backgroundColor: brand.amber },
  cant: { alignSelf: 'center', marginTop: 18, minHeight: 48, justifyContent: 'center' },
  cantText: { fontFamily: fonts.read, fontSize: 16, color: brand.white, textDecorationLine: 'underline' },
});
