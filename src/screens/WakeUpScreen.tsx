// src/screens/WakeUpScreen.tsx
// Fullscreen "WAKE UP" overlay shown when the alarm fires.
// This is the LAST line of defense against the OS swallowing our alarm.
//
// Even if the notification is muted and expo-audio is silent, this screen
// takes over the entire device, plays the bundled alarm sound via expo-av,
// vibrates strongly, and forces the user to deal with the alarm — they
// can only dismiss it by completing the ritual (or by hitting snooze).

import { useEffect, useState } from 'react';
import {
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography } from '../theme';
import { themeEmoji } from '../theme';
import { playAlarmSound, stopAlarmSound } from '../services/alarm';
import type { Task } from '../db/database';

interface Props {
  task: Task;
  onComplete: () => void; // user did the ritual → go to verification
  onSnooze: () => void;   // user wants 5 more minutes
}

/**
 * The fullscreen alarm overlay. Shown when the alarm fires.
 * Cannot be dismissed by the back button. Vibrates on a loop until
 * the user completes the task or hits snooze.
 */
export function WakeUpScreen({ task, onComplete, onSnooze }: Props) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    // Start the sound + vibration
    playAlarmSound();

    // Pulsing background animation (gentle "breathe" effect)
    pulseAnim.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);

    // Strong haptic on a loop until the user deals with it
    let hapticInterval: ReturnType<typeof setInterval> | null = null;
    const startHaptics = () => {
      // Fire a heavy impact immediately
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      // Then continue every 2 seconds
      hapticInterval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 2000);
    };
    startHaptics();

    // Counter (just for the UI "you've been ignoring this for X seconds")
    const tickInterval = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);

    // Block the back button (Android)
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Returning true = handled, prevents default back behavior
      return true;
    });

    return () => {
      pulseAnim.value = 0; // stop animation
      if (hapticInterval) clearInterval(hapticInterval);
      clearInterval(tickInterval);
      backHandler.remove();
      // NOTE: We intentionally do NOT call stopAlarmSound() here. The
      // alarm should keep playing through the verification flow until
      // the user actually completes the task (photo captured, audio
      // recorded, or check-in submitted). Only handleSnooze() stops the
      // sound explicitly. Pressing Home also keeps the sound going.
    };
  }, []);

  // The "I'm doing it" button is the *start* of the task, not the end of it.
  // We deliberately do NOT stop the alarm here — the user could otherwise tap
  // this button and then never actually do the task. The alarm keeps playing
  // through the verification flow and only stops when the task is verified
  // (photo captured, audio recorded, check-in submitted) — see App.tsx
  // onComplete handler.
  const handleComplete = async () => {
    // Subtle "I see you" haptic but keep the alarm going.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onComplete();
  };

  const handleSnooze = async () => {
    await stopAlarmSound();
    onSnooze();
  };

  const backgroundColorStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        pulseAnim.value,
        [0, 1],
        [colors.warning, '#FF8A50'] // gentle orange pulse
      ),
    };
  });

  return (
    <Animated.View style={[styles.container, backgroundColorStyle]}>
      <StatusBar style="light" />

      <View style={styles.topSection}>
        <Text style={styles.timeText}>{formatSeconds(secondsElapsed)}</Text>
        <Text style={styles.labelText}>
          {secondsElapsed < 10 ? 'Wake up.' : secondsElapsed < 30 ? 'Rise.' : 'Your morning is waiting.'}
        </Text>
      </View>

      <BlurView intensity={80} tint="light" style={styles.taskCard}>
        <Text style={styles.themeEmoji}>{themeEmoji(task.theme)}</Text>
        <Text style={styles.taskText}>{task.text}</Text>
        {task.whyItMatters ? (
          <Text style={styles.whyText}>{task.whyItMatters}</Text>
        ) : null}
        <Text style={styles.estTime}>~{task.estSeconds} seconds</Text>
      </BlurView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.snoozeButton]}
          onPress={handleSnooze}
          activeOpacity={0.85}
        >
          <Text style={styles.snoozeButtonText}>Snooze 5 min</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.completeButton]}
          onPress={handleComplete}
          activeOpacity={0.85}
        >
          <Text style={styles.completeButtonText}>I'm doing it →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function formatSeconds(s: number): string {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${ss}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', paddingTop: spacing.xxl },
  timeText: { fontSize: 64, color: colors.cream, fontWeight: '700', marginBottom: spacing.sm },
  labelText: { ...typography.title, color: colors.cream, textAlign: 'center', opacity: 0.9 },
  taskCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  themeEmoji: { fontSize: 56, marginBottom: spacing.md },
  taskText: { ...typography.title, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '700' },
  whyText: { ...typography.body, color: colors.sand, textAlign: 'center', marginBottom: spacing.md, lineHeight: 22 },
  estTime: { ...typography.micro, color: colors.sand, opacity: 0.7 },
  actions: { gap: spacing.sm },
  button: { borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  snoozeButton: { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  snoozeButtonText: { color: colors.cream, ...typography.body, fontWeight: '600' },
  completeButton: { backgroundColor: colors.cream },
  completeButtonText: { color: colors.warning, ...typography.bodyBold, fontSize: 18 },
});
