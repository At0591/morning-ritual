// src/components/StreakHistoryDots.tsx
// 7-day streak history view. Each day = a dot. Filled = completed, empty = missed, ring = today.

import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { DayHistory } from '../db/database';

interface Props {
  days: DayHistory[];
  streakCount: number; // current streak (highlighted next to the row)
}

export function StreakHistoryDots({ days, streakCount }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>This week</Text>
        {streakCount > 0 ? (
          <View style={styles.streakChip}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakNum}>{streakCount}-day streak</Text>
          </View>
        ) : (
          <Text style={styles.muted}>No streak yet</Text>
        )}
      </View>

      <View style={styles.dotsRow}>
        {days.map((day) => {
          const dotStyle = [
            styles.dot,
            day.completed && styles.dotFilled,
            day.isToday && !day.completed && styles.dotToday,
            day.isToday && day.completed && styles.dotTodayFilled,
          ];
          return (
            <View key={day.date} style={styles.dayCol}>
              <View style={dotStyle}>
                {day.completed ? <Text style={styles.dotCheck}>✓</Text> : null}
              </View>
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {day.dayLabel.charAt(0)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const DOT_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyBold,
    color: colors.ink,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  streakFlame: {
    fontSize: 12,
    marginRight: 2,
  },
  streakNum: {
    ...typography.micro,
    color: colors.warning,
  },
  muted: {
    ...typography.caption,
    color: colors.sand,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  dotFilled: {
    backgroundColor: colors.success,
  },
  dotToday: {
    borderWidth: 2,
    borderColor: colors.sunrise,
    backgroundColor: 'transparent',
  },
  dotTodayFilled: {
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.sunrise,
  },
  dotCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dayLabel: {
    ...typography.micro,
    color: colors.sand,
  },
  dayLabelToday: {
    color: colors.sunrise,
    fontWeight: '700',
  },
});
