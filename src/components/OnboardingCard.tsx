// src/components/OnboardingCard.tsx
// Shown to first-time users (when totalCompleted === 0).
// "Got it" hides it until the next launch; it stops showing after the first kept morning.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>WELCOME</Text>
      <Text style={styles.title}>How your mornings work</Text>
      <Text style={styles.body}>
        When your alarm rings, tap the rising sun to show you're up, then write one small good thing. Ten
        minutes later we check you're still up. Today's ritual is optional.
      </Text>

      <View style={styles.bullets}>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>Check your alarm time below</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>On some phones, follow "Make sure your alarm fires"</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>Each ritual shows its evidence and source</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.cta} onPress={onDismiss} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.ctaText}>Got it</Text>
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
