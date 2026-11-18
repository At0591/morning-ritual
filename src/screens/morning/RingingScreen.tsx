// Step 1 of the morning flow: the alarm is ringing (quiet, then rising).
// One action: tap anywhere to start. The tone drops to a whisper for the
// sun tap. A small, limited snooze is available.
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HorizonMark } from '../../components/HorizonMark';
import { splitClock } from '../../utils/dates';
import { playAlarmSound, showOverLockScreen } from '../../services/alarm';
import { brand, fonts } from '../../theme';

interface Props {
  snoozesLeft: number;
  onStart: () => void;
  onSnooze: () => void;
}

export function RingingScreen({ snoozesLeft, onStart, onSnooze }: Props) {
  const [now, setNow] = useState(new Date());
  const rise = useSharedValue(0);

  useEffect(() => {
    // On Android the native ringer is usually already going; this makes sure.
    playAlarmSound();
    showOverLockScreen(true);
    rise.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
    const tick = setInterval(() => setNow(new Date()), 15_000);
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      clearInterval(tick);
      back.remove();
    };
  }, []);

  const insets = useSafeAreaInsets();
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * rise.value }] }));
  const { time, suffix } = splitClock(now);
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Pressable
      style={[styles.container, { paddingBottom: 24 + insets.bottom }]}
      onPress={onStart}
      accessibilityRole="button"
      accessibilityLabel="Alarm ringing. Tap anywhere to start your morning."
    >
      <StatusBar style="light" />
      <Text style={styles.hello}>Good morning</Text>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{time}</Text>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      <Text style={styles.date}>{date}</Text>
      <Animated.View style={[styles.mark, sunStyle]}>
        <HorizonMark size={180} />
      </Animated.View>
      <View style={styles.spacer} />
      <Text style={styles.cta}>Tap anywhere to start your morning</Text>
      <Text style={styles.sub}>Your tune gets louder until you do</Text>
      {snoozesLeft > 0 ? (
        <Pressable onPress={onSnooze} hitSlop={12} style={styles.snooze} accessibilityRole="button">
          <Text style={styles.snoozeText}>
            Snooze 5 minutes ({snoozesLeft} left)
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.night, alignItems: 'center', paddingTop: 72, paddingBottom: 40, paddingHorizontal: 24 },
  hello: { fontFamily: fonts.read, fontSize: 17, color: brand.mist },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  time: { fontFamily: fonts.display, fontSize: 88, color: brand.white, lineHeight: 100 },
  suffix: { fontFamily: fonts.read, fontSize: 22, color: brand.mist, marginLeft: 8 },
  date: { fontFamily: fonts.read, fontSize: 16, color: brand.mist },
  mark: { marginTop: 48 },
  spacer: { flex: 1 },
  cta: { fontFamily: fonts.readBold, fontSize: 19, color: brand.white, textAlign: 'center' },
  sub: { fontFamily: fonts.read, fontSize: 14, color: brand.mist, marginTop: 6 },
  snooze: { marginTop: 22, minHeight: 48, justifyContent: 'center' },
  snoozeText: { fontFamily: fonts.read, fontSize: 15, color: brand.mist, textDecorationLine: 'underline' },
});
