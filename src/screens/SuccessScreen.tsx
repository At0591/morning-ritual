// src/screens/SuccessScreen.tsx
// Celebration after task completion. Shows:
//   - Big ✓
//   - New streak count (1, 2, 3... day)
//   - Encouraging message
//   - Tomorrow's task preview (builds anticipation for the next morning)
//   - "Done" button to return home

import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, themeEmoji, themeColor } from '../theme';
import type { Task } from '../db/database';

interface Props {
  streakCount: number;
  isNewRecord: boolean;
  tomorrowTask: Task | null;
  onDone: () => void;
}

const encouragements = [
  "Beautiful. That's how mornings become something you look forward to.",
  "Done. Tomorrow's task is going to be a different kind of good.",
  "Locked in. One more day, one more ritual.",
  "That's the move. Most people never start — you just did.",
  "Streak updated. You're building something.",
];

export function SuccessScreen({ streakCount, isNewRecord, tomorrowTask, onDone }: Props) {
  const scale = useSharedValue(0.3);
  const fade = useSharedValue(0);
  const tomorrowFade = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSpring(1, { damping: 10, stiffness: 100 });
    fade.value = withDelay(200, withTiming(1, { duration: 600 }));
    // Delay tomorrow preview until after the streak animation
    tomorrowFade.value = withDelay(800, withTiming(1, { duration: 600 }));
  }, []);

  const checkCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const mainFadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  const tomorrowCardStyle = useAnimatedStyle(() => ({
    opacity: tomorrowFade.value,
  }));

  const msg = encouragements[streakCount % encouragements.length];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.checkCircle, checkCircleStyle]}>
        <Text style={styles.check}>✓</Text>
      </Animated.View>

      <Animated.View style={[mainFadeStyle, { alignItems: 'center' }]}>
        <Text style={styles.streakLabel}>YOUR STREAK</Text>
        <Text style={styles.streakCount}>{streakCount}</Text>
        <Text style={styles.streakUnit}>
          {streakCount === 1 ? 'day' : 'days'} in a row
        </Text>

        {isNewRecord ? (
          <View style={styles.recordBadge}>
            <Text style={styles.recordText}>🏆 New personal record</Text>
          </View>
        ) : null}

        <Text style={styles.message}>{msg}</Text>
      </Animated.View>

      {tomorrowTask ? (
        <Animated.View style={[styles.tomorrowCard, tomorrowCardStyle]}>
          <Text style={styles.tomorrowLabel}>TOMORROW</Text>
          <View style={styles.tomorrowRow}>
            <Text style={styles.tomorrowEmoji}>{themeEmoji(tomorrowTask.theme)}</Text>
            <View style={styles.tomorrowText}>
              <Text style={styles.tomorrowTheme}>{tomorrowTask.theme}</Text>
              <Text style={styles.tomorrowPreview} numberOfLines={2}>
                {tomorrowTask.text}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <TouchableOpacity style={styles.cta} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.success,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  check: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '800',
  },
  streakLabel: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.xs,
  },
  streakCount: {
    fontSize: 80,
    fontWeight: '800',
    color: colors.sunrise,
    lineHeight: 88,
  },
  streakUnit: {
    ...typography.body,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  recordBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  recordText: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  message: {
    ...typography.body,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    maxWidth: 320,
    lineHeight: 24,
  },
  tomorrowCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  tomorrowLabel: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.sm,
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tomorrowEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  tomorrowText: {
    flex: 1,
  },
  tomorrowTheme: {
    ...typography.bodyBold,
    color: colors.ink,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  tomorrowPreview: {
    ...typography.caption,
    color: colors.sand,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    ...typography.bodyBold,
  },
});
