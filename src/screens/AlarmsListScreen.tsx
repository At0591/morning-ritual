import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { getAllAlarms, updateAlarm, Alarm } from '../db/database';
import { useIsFocused } from '@react-navigation/native';

interface Props {
  onBack: () => void;
  onEditAlarm: (id: string) => void;
  onCreateAlarm: () => void;
}

export function AlarmsListScreen({ onBack, onEditAlarm, onCreateAlarm }: Props) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const loadAlarms = async () => {
    try {
      const data = await getAllAlarms();
      setAlarms(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadAlarms();
    }
  }, [isFocused]);

  const toggleAlarm = async (id: string, enabled: boolean) => {
    await updateAlarm(id, { enabled });
    loadAlarms();
  };

  const formatDays = (days: number[]) => {
    if (days.length === 0) return 'One-time';
    if (days.length === 7) return 'Every day';
    const isWeekdays = days.length === 5 && !days.includes(0) && !days.includes(6);
    if (isWeekdays) return 'Weekdays';
    const isWeekends = days.length === 2 && days.includes(0) && days.includes(6);
    if (isWeekends) return 'Weekends';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.sort().map(d => dayNames[d]).join(', ');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Your Alarms</Text>
        <TouchableOpacity onPress={onCreateAlarm} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="plus" size={24} color={colors.sunrise} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.sunrise} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          {alarms.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No alarms set.</Text>
            </View>
          ) : (
            alarms.map(alarm => (
              <TouchableOpacity
                key={alarm.id}
                style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDisabled]}
                onPress={() => onEditAlarm(alarm.id)}
              >
                <View style={styles.alarmInfo}>
                  <Text style={[styles.alarmTime, !alarm.enabled && styles.textDisabled]}>
                    {alarm.time}
                  </Text>
                  <Text style={[styles.alarmDays, !alarm.enabled && styles.textDisabled]}>
                    {formatDays(alarm.days)} {alarm.smartWakeWindow > 0 && ` • Smart Wake (${alarm.smartWakeWindow}m)`}
                  </Text>
                </View>
                <Switch
                  value={alarm.enabled}
                  onValueChange={(val) => toggleAlarm(alarm.id, val)}
                  trackColor={{ false: colors.divider, true: colors.sunrise }}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  list: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.sand,
  },
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  alarmCardDisabled: {
    opacity: 0.6,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmTime: {
    ...typography.heading,
    fontSize: 32,
    color: colors.ink,
  },
  alarmDays: {
    ...typography.caption,
    color: colors.sand,
    marginTop: spacing.xs,
  },
  textDisabled: {
    color: colors.sand,
  },
});
