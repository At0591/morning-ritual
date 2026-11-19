// src/screens/SettingsScreen.tsx
// App settings: theme preference, alarm time, sound, bedtime, reset data.

import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography, themeEmoji } from '../theme';
import { SOUND_OPTIONS } from '../services/sounds';

interface Props {
  preferredTheme: string | null;
  selectedSound: string;
  bedtime: string;
  bedtimeEnabled: boolean;
  subscriptionTier: 'free' | 'premium';
  onChangeTheme: (theme: string | null) => Promise<void>;
  onChangeSound: (soundId: string) => Promise<void>;
  onChangeBedtime: (time: string, enabled: boolean) => Promise<void>;
  onResetAllData: () => Promise<void>;
  onUpgrade: () => void;
  onManageAlarms: () => void;
  onBack: () => void;
  analyticsEnabled: boolean;
  onChangeAnalytics: (enabled: boolean) => void;
  onExportJournal: () => void;
}

const THEMES: Array<{ key: string; label: string; emoji: string; color: string }> = [
  { key: 'body', label: 'Body', emoji: '🧘', color: colors.body },
  { key: 'mind', label: 'Mind', emoji: '🧠', color: colors.mind },
  { key: 'brain', label: 'Brain', emoji: '💡', color: colors.brain },
  { key: 'creative', label: 'Creative', emoji: '🎨', color: colors.creative },
];

export function SettingsScreen({
  preferredTheme,
  selectedSound,
  bedtime,
  bedtimeEnabled,
  subscriptionTier,
  onChangeTheme,
  onChangeSound,
  onChangeBedtime,
  onResetAllData,
  onUpgrade,
  onManageAlarms,
  onBack,
  analyticsEnabled,
  onChangeAnalytics,
  onExportJournal,
}: Props) {
  const [resetting, setResetting] = useState(false);
  const [bedtimeInput, setBedtimeInput] = useState(bedtime);

  useEffect(() => {
    setBedtimeInput(bedtime);
  }, [bedtime]);

  const handleReset = () => {
    Alert.alert(
      'Reset all data?',
      'This will delete your streak, task history, chains, and preferences. Tasks library will be reloaded. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await onResetAllData();
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleBedtimeSave = async () => {
    if (!/^\d{1,2}:\d{2}$/.test(bedtimeInput)) {
      Alert.alert('Invalid time', 'Please use HH:MM format (e.g., 22:30)');
      return;
    }
    await onChangeBedtime(bedtimeInput, bedtimeEnabled);
    Alert.alert('Bedtime set', `Reminder will fire at ${bedtimeInput} (30 min before, you'll get a wind-down nudge).`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Premium / upgrade banner */}
      {subscriptionTier === 'free' ? (
        <TouchableOpacity style={styles.upgradeCard} onPress={onUpgrade} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>Premium is coming</Text>
            <Text style={styles.upgradeSub}>
              Stricter wake-up modes for heavy snoozers, more tunes and insights. The alarm and your journal will always be free.
            </Text>
          </View>
          <Text style={styles.upgradeArrow}>→</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>You have Premium. Thank you.</Text>
        </View>
      )}

      {/* Theme preference */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily theme</Text>
        <Text style={styles.sectionSub}>
          {preferredTheme
            ? `Focusing on ${preferredTheme} tasks. Switch to a different theme, or pick "Any" to mix it up.`
            : 'Mixing all four themes. Pick a focus to weight the daily pick toward it.'}
        </Text>
        <View style={styles.themeRow}>
          <TouchableOpacity
            style={[styles.themeChip, !preferredTheme && styles.themeChipActive]}
            onPress={() => onChangeTheme(null)}
          >
            <Text style={styles.themeChipEmoji}>🌅</Text>
            <Text style={[styles.themeChipText, !preferredTheme && styles.themeChipTextActive]}>
              Any
            </Text>
          </TouchableOpacity>
          {THEMES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.themeChip,
                preferredTheme === t.key && styles.themeChipActive,
                preferredTheme === t.key && { borderColor: t.color },
              ]}
              onPress={() => onChangeTheme(t.key)}
            >
              <Text style={styles.themeChipEmoji}>{t.emoji}</Text>
              <Text
                style={[
                  styles.themeChipText,
                  preferredTheme === t.key && styles.themeChipTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Manage Alarms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alarms</Text>
        <Text style={styles.sectionSub}>Set your wake-up times and the days they ring.</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={onManageAlarms}>
          <Text style={[styles.resetBtnText, { color: colors.sunrise }]}>⏰ Manage Alarms</Text>
        </TouchableOpacity>
      </View>

      {/* Alarm sound picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alarm sound</Text>
        <Text style={styles.sectionSub}>
          Pick the sound that wakes you. All 5 are gentle nature recordings
          from Freesound (CC0), free for everyone.
        </Text>
        {SOUND_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.soundRow, selectedSound === s.id && styles.soundRowActive]}
            onPress={() => onChangeSound(s.id)}
          >
            <Text style={styles.soundEmoji}>{s.emoji}</Text>
            <View style={styles.soundText}>
              <Text style={[styles.soundName, selectedSound === s.id && styles.soundNameActive]}>
                {s.name}
              </Text>
              <Text style={styles.soundDesc}>{s.description}</Text>
            </View>
            {selectedSound === s.id && <Text style={styles.soundCheck}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Bedtime reminder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bedtime reminder</Text>
        <Text style={styles.sectionSub}>
          A reminder 30 minutes before the time you want to be asleep.
        </Text>
        <View style={styles.bedtimeRow}>
          <Text style={styles.bedtimeLabel}>Sleep by</Text>
          <TextInput
            style={styles.bedtimeInput}
            value={bedtimeInput}
            onChangeText={setBedtimeInput}
            placeholder="22:30"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <TouchableOpacity
            style={[styles.smallBtn, !bedtimeEnabled && styles.smallBtnDisabled]}
            onPress={handleBedtimeSave}
          >
            <Text style={styles.smallBtnText}>{bedtimeEnabled ? 'Update' : 'Enable'}</Text>
          </TouchableOpacity>
        </View>
        {bedtimeEnabled ? (
          <Text style={styles.bedtimeStatus}>On: you'll get a reminder 30 minutes before {bedtime}.</Text>
        ) : null}
      </View>



      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.sectionSub}>
          Your journal, streak and rituals stay on this phone. They are not backed up or sent anywhere.
        </Text>
        <View style={styles.privacyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyLabel}>Share anonymous usage counts</Text>
            <Text style={styles.sectionSub}>Never your journal or anything you type.</Text>
          </View>
          <Switch
            value={analyticsEnabled}
            onValueChange={onChangeAnalytics}
            accessibilityLabel="Share anonymous usage counts"
          />
        </View>
        <TouchableOpacity style={styles.resetBtn} onPress={onExportJournal} accessibilityRole="button">
          <Text style={[styles.resetBtnText, { color: colors.sunrise }]}>Export my journal</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          KindRise 1.0.1
          {'\n'}41 morning rituals, each with its evidence level and source.
        </Text>
      </View>

      {/* Reset */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.resetBtn, resetting && styles.resetBtnDisabled]}
          onPress={handleReset}
          disabled={resetting}
        >
          <Text style={styles.resetBtnText}>
            {resetting ? 'Resetting…' : 'Reset all data'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  privacyLabel: { ...typography.bodyBold, color: colors.ink },
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.sm,
  },
  backBtnText: {
    ...typography.body,
    color: colors.sunrise,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.sand,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunrise,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  upgradeTitle: {
    ...typography.bodyBold,
    color: colors.cream,
    marginBottom: 2,
  },
  upgradeSub: {
    ...typography.caption,
    color: 'rgba(250, 247, 242, 0.9)',
  },
  upgradeArrow: {
    fontSize: 24,
    color: colors.cream,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  premiumBadge: {
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  premiumBadgeText: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeChipActive: {
    backgroundColor: '#FFF3E0',
    borderColor: colors.sunrise,
  },
  themeChipEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  themeChipText: {
    ...typography.body,
    color: colors.ink,
  },
  themeChipTextActive: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  soundRowActive: {
    borderColor: colors.sunrise,
    backgroundColor: '#FFF3E0',
  },
  soundEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  soundText: {
    flex: 1,
  },
  soundName: {
    ...typography.body,
    color: colors.ink,
  },
  soundNameActive: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  soundDesc: {
    ...typography.micro,
    color: colors.sand,
    marginTop: 2,
  },
  soundCheck: {
    color: colors.success,
    ...typography.bodyBold,
  },
  bedtimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bedtimeLabel: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  bedtimeInput: {
    ...typography.bodyBold,
    color: colors.ink,
    width: 60,
    textAlign: 'center',
    marginRight: spacing.md,
  },
  smallBtn: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smallBtnDisabled: {
    backgroundColor: colors.divider,
  },
  smallBtnText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  bedtimeStatus: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  aboutText: {
    ...typography.caption,
    color: colors.sand,
    lineHeight: 20,
  },
  resetBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resetBtnDisabled: {
    opacity: 0.5,
  },
  resetBtnText: {
    color: colors.error,
    ...typography.bodyBold,
  },
});
