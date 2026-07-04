// src/screens/TaskRevealScreen.tsx
// The core UX moment. When the user opens the app to their morning task, this
// is what they see. Text-first, with a "Start verification" CTA below.
//
// Design intent (from spec):
//   - Calm, aspirational tone — never punitive
//   - The task gets 2-3 seconds of "breathing room" before the CTA appears
//   - Theme emoji + color hint at the type of task
//   - 10-second "read time" suggests when to start (subtle, not forced)
//   - Smart snooze: progressive cost (5/10/20 min), max 3 snoozes

import { useEffect, useState } from 'react';
import {
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, spacing, radius, typography, themeColor, themeEmoji, shadows } from '../theme';
import type { Task } from '../db/database';
import { scheduleAlarm } from '../services/alarm';
import { trackTaskRevealed, trackTaskSnoozed } from '../services/analytics';

interface Props {
  task: Task;
  onStartVerification: () => void;
  onSkip: () => void;
  onSnoozed?: () => void;  // optional: when snooze is used, go back to home
}

const SNOOZE_DELAYS = [5, 10, 20]; // minutes, progressive
const MAX_SNOOZES = 3;

export function TaskRevealScreen({ task, onStartVerification, onSkip, onSnoozed }: Props) {
  const [readTimeLeft, setReadTimeLeft] = useState(10);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeMessage, setSnoozeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (readTimeLeft <= 0) return;
    const t = setTimeout(() => setReadTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [readTimeLeft]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prevent exiting the app, the alarm is likely still ringing
      return true;
    });
    trackTaskRevealed({ taskTheme: task.theme });
    return () => backHandler.remove();
  }, []);

  const onSnooze = async () => {
    if (snoozeCount >= MAX_SNOOZES || snoozing) return;
    setSnoozing(true);
    const delay = SNOOZE_DELAYS[snoozeCount];
    const nextFire = new Date(Date.now() + delay * 60_000);
    try {
      await scheduleAlarm(nextFire, task.id, task.text, 0);
      const newCount = snoozeCount + 1;
      setSnoozeCount(newCount);
      trackTaskSnoozed({ taskTheme: task.theme, snoozeDurationMins: delay });
      setSnoozeMessage(
        `Snoozed ${delay} min. ${MAX_SNOOZES - newCount > 0
          ? `${MAX_SNOOZES - newCount} snooze${MAX_SNOOZES - newCount === 1 ? '' : 's'} left.`
          : 'No more snoozes — this is your last one.'
        }`
      );
      // If they used their last snooze, exit to home so the next alarm fires
      if (newCount >= MAX_SNOOZES && onSnoozed) {
        setTimeout(() => onSnoozed(), 2500);
      }
    } catch (e) {
      // ignore — non-critical
    } finally {
      setSnoozing(false);
    }
  };

  const snoozeAvailable = snoozeCount < MAX_SNOOZES;
  const nextSnoozeDelay = snoozeAvailable ? SNOOZE_DELAYS[snoozeCount] : 0;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.header}>
        <Text style={styles.greeting}>Good morning</Text>
        <View style={[styles.themeBadge, { backgroundColor: themeColor(task.theme) + '20' }]}>
          <Text style={styles.themeEmoji}>{themeEmoji(task.theme)}</Text>
          <Text style={[styles.themeName, { color: themeColor(task.theme) }]}>
            {task.theme}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.card}>
        <Text style={styles.label}>Your morning task</Text>
        <Text style={styles.taskText}>{task.text}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>
            {task.verification === 'media'
              ? `📷 ${task.mediaType ?? 'capture'}`
              : '✓ Check-in'}
          </Text>
          <Text style={styles.metaDivider}>·</Text>
          <Text style={styles.metaItem}>~{task.estSeconds}s</Text>
        </View>

        {task.whyItMatters ? (
          <View style={styles.whyBox}>
            <Text style={styles.whyLabel}>WHY IT MATTERS</Text>
            <Text style={styles.whyText}>{task.whyItMatters}</Text>
          </View>
        ) : null}
      </Animated.View>

      {snoozeMessage ? (
        <View style={styles.snoozeBanner}>
          <Text style={styles.snoozeBannerText}>💤 {snoozeMessage}</Text>
        </View>
      ) : readTimeLeft > 0 ? (
        <Text style={styles.readHint}>
          Take a breath. Starting in {readTimeLeft}s…
        </Text>
      ) : null}

      <Animated.View entering={FadeInUp.duration(600).delay(450)}>
        <TouchableOpacity
          style={styles.cta}
          onPress={onStartVerification}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {readTimeLeft > 0 ? `Read for ${readTimeLeft}s more` : 'Start verification'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(500)}>
        {snoozeAvailable ? (
          <TouchableOpacity
            style={[styles.snoozeBtn, snoozing && styles.snoozeBtnDisabled]}
            onPress={onSnooze}
            disabled={snoozing}
          >
            <Text style={styles.snoozeBtnText}>
              {snoozing
                ? '…'
                : `Snooze ${nextSnoozeDelay} min`}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.snoozeExhausted}>
            <Text style={styles.snoozeExhaustedText}>
              No more snoozes — commit to the ritual.
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(600)}>
        <TouchableOpacity style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for today</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.body,
    color: colors.sand,
    marginBottom: spacing.sm,
  },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  themeEmoji: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  themeName: {
    ...typography.bodyBold,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.md,
    ...shadows.md,
  },
  label: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.sm,
  },
  taskText: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaItem: {
    ...typography.caption,
    color: colors.sand,
  },
  metaDivider: {
    ...typography.caption,
    color: colors.sand,
    marginHorizontal: spacing.sm,
  },
  whyBox: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  whyLabel: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.xs,
  },
  whyText: {
    ...typography.caption,
    color: colors.ink,
    lineHeight: 20,
  },
  readHint: {
    ...typography.caption,
    color: colors.sand,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  snoozeBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  snoozeBannerText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  ctaText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  snoozeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  snoozeBtnDisabled: {
    opacity: 0.5,
  },
  snoozeBtnText: {
    ...typography.body,
    color: colors.ink,
  },
  snoozeExhausted: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  snoozeExhaustedText: {
    ...typography.caption,
    color: colors.sand,
    fontStyle: 'italic',
  },
  skip: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.caption,
    color: colors.sand,
  },
});
