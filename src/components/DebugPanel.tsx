// Developer-only tools for checking notifications and the alarm queue.
// Rendered only in __DEV__ builds.
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  cancelAllAlarms,
  fireDelayedNotification,
  fireImmediateNotification,
  getScheduledAlarms,
} from '../services/alarm';
import { errorMessage } from '../utils/errors';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  candidatePoolSize: number;
  excludedByRepeat: number;
};

async function run(label: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    Alert.alert(`${label} failed`, errorMessage(e));
  }
}

const onTestImmediate = () => run('Immediate test', () => fireImmediateNotification());

const onTestDelayed = () =>
  run('Delayed test', async () => {
    await fireDelayedNotification(10);
    Alert.alert('Test scheduled', 'Should fire in 10s. Keep the app open or in background.');
  });

const onTestMinute = () =>
  run('60s test', async () => {
    await fireDelayedNotification(60);
    Alert.alert('Test scheduled', 'Should fire in 60s. Check the phone in 1 min.');
  });

const onListScheduled = () =>
  run('List', async () => {
    const all = await getScheduledAlarms();
    if (all.length === 0) {
      Alert.alert('No scheduled alarms', 'Nothing pending. Schedule one and check again.');
      return;
    }
    const summary = all
      .map(
        (n) =>
          `• ${n.identifier.slice(-8)}  →  ${new Date(n.fireAt).toLocaleTimeString()}\n   "${n.taskText}..."  ${n.fired ? '✓ fired' : '⏳ pending'}`
      )
      .join('\n\n');
    Alert.alert(`${all.length} scheduled`, summary);
  });

const onCancelAll = () =>
  run('Cancel', async () => {
    await cancelAllAlarms();
    Alert.alert('Cancelled', 'All scheduled alarms cleared.');
  });

export function DebugPanel({ candidatePoolSize, excludedByRepeat }: Props) {
  return (
    <>
      <Text style={styles.footer}>
        Pool: {candidatePoolSize} tasks
        {excludedByRepeat > 0 ? ` · ${excludedByRepeat} excluded for variety` : ''}
      </Text>

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>🔧 Notification Debug</Text>
        <Text style={styles.debugHelp}>Tap these to figure out which part is broken.</Text>
        <TouchableOpacity style={styles.debugBtn} onPress={onTestImmediate} activeOpacity={0.85}>
          <Text style={styles.debugBtnText}>🔔 Test notification NOW</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugBtn} onPress={onTestDelayed} activeOpacity={0.85}>
          <Text style={styles.debugBtnText}>⏰ Test in 10 seconds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugBtn} onPress={onTestMinute} activeOpacity={0.85}>
          <Text style={styles.debugBtnText}>⏱️ Test in 60 seconds (matches real alarm)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugBtn} onPress={onListScheduled} activeOpacity={0.85}>
          <Text style={styles.debugBtnText}>📋 List scheduled alarms</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugBtn} onPress={onCancelAll} activeOpacity={0.85}>
          <Text style={styles.debugBtnText}>🗑️ Cancel all alarms</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    ...typography.caption,
    color: colors.sand,
    textAlign: 'center',
  },
  debugBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  debugTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: spacing.xs,
  },
  debugHelp: {
    ...typography.caption,
    color: '#795548',
    marginBottom: spacing.sm,
  },
  debugBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  debugBtnText: {
    ...typography.body,
    color: '#BF360C',
    textAlign: 'center',
  },
});
