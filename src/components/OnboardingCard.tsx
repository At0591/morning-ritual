// src/components/OnboardingCard.tsx
// Shown to first-time users (when totalCompleted === 0).
// Two taps: "Got it" → dismisses. We don't store the dismissal — it reappears on next
// app launch until the user actually completes their first task.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>WELCOME</Text>
      <Text style={styles.title}>Start with intention</Text>
      <Text style={styles.body}>
        Each morning, you'll get one small task. Capture it, check it off, and start your day
        with a win. No streaks to defend — just a ritual worth keeping.
      </Text>

      <View style={styles.bullets}>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>Set your wake time above</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>Tap "Reveal today's task" to begin</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>Complete a task to start your streak</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.cta} onPress={onDismiss} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Got it — show me today's task</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  eyebrow: {
    ...typography.micro,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.ink,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  bullets: {
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  bulletDot: {
    ...typography.body,
    color: colors.warning,
    width: 16,
  },
  bulletText: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  cta: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    ...typography.bodyBold,
  },
});
