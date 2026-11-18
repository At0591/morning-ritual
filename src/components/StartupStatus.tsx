// What the app shows before the navigator: loading, or a startup error.
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, radius, spacing, typography } from '../theme';

export function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.sunrise} />
      <Text style={styles.subtext}>Waking up the database…</Text>
      <StatusBar style="auto" />
    </View>
  );
}

export function StartupErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorEmoji}>😕</Text>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryButtonText}>Try again</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  subtext: {
    marginTop: spacing.md,
    color: colors.sand,
  },
  errorEmoji: { fontSize: 64, marginBottom: spacing.md },
  errorTitle: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.sand,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: { color: colors.cream, ...typography.bodyBold },
});
