import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '../theme';
import { getAlarmById, Alarm, addAlarm, updateAlarm, deleteAlarm } from '../db/database';

interface Props {
  alarmId: string | null; // null means create new
  /** "HH:MM" to start a new alarm at (from the sunrise card). */
  initialTime?: string | null;
  onBack: () => void;
  onSave: () => void;
}

export function EditAlarmScreen({ alarmId, initialTime, onBack, onSave }: Props) {
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [smartWakeWindow, setSmartWakeWindow] = useState(0);

  useEffect(() => {
    if (alarmId) {
      // Load existing
      getAlarmById(alarmId).then((alarm) => {
        if (alarm) {
          const [hh, mm] = alarm.time.split(':').map(Number);
          const d = new Date();
          d.setHours(hh, mm, 0, 0);
          setTime(d);
          setDays(alarm.days);
          setSmartWakeWindow(alarm.smartWakeWindow);
        }
      });
    } else {
      // Defaults for new
      const [hh, mm] = (initialTime ?? '07:00').split(':').map(Number);
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      setTime(d);
      setDays([1, 2, 3, 4, 5]); // Weekdays default
    }
  }, [alarmId, initialTime]);

  const toggleDay = (day: number) => {
    if (days.includes(day)) {
      setDays(days.filter(d => d !== day));
    } else {
      setDays([...days, day].sort());
    }
  };

  const save = async () => {
    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    if (alarmId) {
      await updateAlarm(alarmId, {
        time: timeStr,
        days,
        smartWakeWindow,
      });
    } else {
      const newId = Math.random().toString(36).substring(2, 9);
      await addAlarm({
        id: newId,
        time: timeStr,
        days,
        enabled: true,
        soundId: null,
        smartWakeWindow,
      });
    }
    onSave();
  };

  const handleDelete = () => {
    Alert.alert('Delete Alarm', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (alarmId) await deleteAlarm(alarmId);
        onSave();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{alarmId ? 'Edit Alarm' : 'New Alarm'}</Text>
        <TouchableOpacity onPress={save} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Save alarm">
          <Feather name="check" size={24} color={colors.sunrise} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Time</Text>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.timeBtnText}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={(e, d) => {
                setShowTimePicker(false);
                if (d) setTime(d);
              }}
            />
          )}
        </View>

        {/* Days */}
        <View style={styles.section}>
          <Text style={styles.label}>Repeat</Text>
          <View style={styles.daysRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, idx) => {
              const active = days.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dayCircle, active && styles.dayCircleActive]}
                  onPress={() => toggleDay(idx)}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{dayChar}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Smart Wake is out of the launch build (unproven; needed extra permissions). */}

        {alarmId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Alarm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.bodyBold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtext: {
    ...typography.caption,
    color: colors.sand,
    marginBottom: spacing.md,
  },
  timeBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  timeBtnText: {
    ...typography.heading,
    fontSize: 48,
    color: colors.ink,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.sunrise,
  },
  dayText: {
    ...typography.bodyBold,
    color: colors.sand,
  },
  dayTextActive: {
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.divider,
  },
  chipActive: {
    backgroundColor: colors.ink,
  },
  chipText: {
    ...typography.bodyBold,
    color: colors.sand,
  },
  chipTextActive: {
    color: '#fff',
  },
  deleteBtn: {
    marginTop: spacing.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  deleteBtnText: {
    ...typography.bodyBold,
    color: colors.warning,
  },
});
