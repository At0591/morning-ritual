// src/screens/OnboardingFlow.tsx
// 3-screen first-launch onboarding: Welcome → Pick theme → Set alarm time.
// Shown when totalCompleted === 0 (first-time user).
//
// Each step stores its value in the DB as the user moves forward, so even
// if they back out and come back, their choices persist.

import { useState, useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HorizonMark } from '../components/HorizonMark';
import { brand, colors, radius, spacing, typography } from '../theme';
import { addAlarm, getAllAlarms, setSetting, updateAlarm } from '../db/database';
import { trackEvent, trackOnboardingStart, trackOnboardingComplete } from '../services/analytics';

interface Props {
  onComplete: () => void;
}

const THEMES: Array<{ key: string; label: string; emoji: string; color: string; tagline: string }> = [
  { key: 'body', label: 'Body', emoji: '🧘', color: colors.body, tagline: 'Move, stretch, hydrate, breathe' },
  { key: 'mind', label: 'Mind', emoji: '🧠', color: colors.mind, tagline: 'Journal, meditate, reflect' },
  { key: 'brain', label: 'Brain', emoji: '💡', color: colors.brain, tagline: 'Puzzles, languages, deep reading' },
  { key: 'creative', label: 'Creative', emoji: '🎨', color: colors.creative, tagline: 'Sketch, cook, write, experiment' },
];

type Step = 0 | 1 | 2;

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(0);
  // Keep the buttons clear of the status bar and the phone's navigation bar.
  const insets = useSafeAreaInsets();
  
  // Track onboarding started on mount
  useEffect(() => {
    trackOnboardingStart();
  }, []);

  const [theme, setTheme] = useState<string | null>(null);
  const [alarmDate, setAlarmDate] = useState(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const finish = async (selectedTheme: string | null, selectedTime: Date) => {
    try {
      await setSetting('preferred_theme', selectedTheme ?? '');
      const hh = String(selectedTime.getHours()).padStart(2, '0');
      const mm = String(selectedTime.getMinutes()).padStart(2, '0');
      await setSetting('alarm_time', `${hh}:${mm}`);
      // Turn the chosen time into a real alarm. Before, onboarding only saved a
      // setting (new users had no alarm), and it ignored the choice when an
      // alarm already existed. Now it creates one, or updates the earliest.
      const existing = await getAllAlarms();
      if (existing.length === 0) {
        await addAlarm({
          id: `alarm-${Date.now()}`,
          time: `${hh}:${mm}`,
          days: [0, 1, 2, 3, 4, 5, 6],
          enabled: true,
          soundId: null,
          smartWakeWindow: 0,
        });
      } else {
        await updateAlarm(existing[0].id, { time: `${hh}:${mm}`, enabled: true });
      }
      await setSetting('onboarding_complete', '1');
    } catch (e) {
      console.warn('Failed to save onboarding settings:', e);
    }
    trackOnboardingComplete({
      selectedTheme: selectedTheme ?? 'mixed',
      alarmTime: `${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}`
    });
    onComplete();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <Animated.View entering={FadeInRight.duration(400)} style={styles.stepContainer}>
            <View style={styles.heroMark}>
              <HorizonMark size={72} sunColor="#E89A2E" lineColor={brand.ink} />
            </View>
            <Text style={styles.title}>Never oversleep,{'\n'}without the punishment.</Text>
            <Text style={styles.subtitle}>
              A soft tune wakes you, a quick check makes sure you're up, and one small good thing starts your day.
            </Text>
            <View style={styles.bullets}>
              {[
                { icon: 'music' as const, text: 'A gentle tune that starts quiet and slowly gets louder.' },
                { icon: 'sun' as const, text: "Tap the rising sun to show you're awake. No maths, no squats." },
                { icon: 'edit-3' as const, text: "Write one small good thing, or pick a suggestion. Ten minutes later we check you're still up." },
                { icon: 'lock' as const, text: 'Your journal stays on your phone. No account. Usage stats only if you say yes.' },
              ].map((b) => (
                <View key={b.icon} style={styles.bulletRow}>
                  <Feather name={b.icon} size={22} color={colors.warning} style={styles.bulletIcon} />
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={() => setStep(1)}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* STEP 1: Pick theme */}
        {step === 1 && (
          <Animated.View entering={FadeInRight.duration(400)} style={styles.stepContainer}>
            <Text style={styles.title}>Pick a focus</Text>
            <Text style={styles.subtitle}>
              After you're up, there's an optional ritual: 41 to choose from, each with its evidence and source. Yours will lean toward this. Change it anytime in Settings.
            </Text>
            <View style={styles.themeGrid}>
              <TouchableOpacity
                style={[
                  styles.themeCard,
                  theme === null && styles.themeCardActive,
                ]}
                onPress={() => setTheme(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.themeEmoji}>✨</Text>
                <Text style={styles.themeLabel}>Mix it up</Text>
                <Text style={styles.themeTagline}>One of all four themes each day</Text>
              </TouchableOpacity>
              {THEMES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.themeCard,
                    theme === t.key && styles.themeCardActive,
                    theme === t.key && { borderColor: t.color },
                  ]}
                  onPress={() => setTheme(t.key)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.themeEmoji}>{t.emoji}</Text>
                  <Text style={styles.themeLabel}>{t.label}</Text>
                  <Text style={styles.themeTagline}>{t.tagline}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setStep(0)}
                activeOpacity={0.85}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.buttonFlex]}
                onPress={() => {
                  trackEvent('Theme_Selected', { theme: theme ?? 'mixed' });
                  setStep(2);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* STEP 2: Set alarm time */}
        {step === 2 && (
          <Animated.View entering={FadeInRight.duration(400)} style={styles.stepContainer}>
            <Text style={styles.title}>Set your wake time</Text>
            <Text style={styles.subtitle}>
              Your alarm rings at this time every day. You can change it or add more alarms later.
            </Text>

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.timeButtonText}>
                {`${String(alarmDate.getHours()).padStart(2, '0')}:${String(alarmDate.getMinutes()).padStart(2, '0')}`}
              </Text>
              <Text style={styles.timeButtonHint}>Tap to change</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={alarmDate}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) setAlarmDate(date);
                }}
              />
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setStep(1)}
                activeOpacity={0.85}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.buttonFlex]}
                onPress={() => finish(theme, alarmDate)}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>I'm ready</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { padding: spacing.lg },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: colors.sunrise },
  dotInactive: { backgroundColor: colors.divider },
  stepContainer: { alignItems: 'center' },
  heroMark: { marginBottom: spacing.md, alignItems: 'center' },
  title: {
    ...typography.title,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    color: colors.sand,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  bullets: { alignSelf: 'stretch', marginBottom: spacing.xl },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  bulletIcon: { marginRight: spacing.md, marginTop: 2 },
  bulletText: { ...typography.body, color: colors.ink, flex: 1, lineHeight: 22 },
  themeGrid: { alignSelf: 'stretch', marginBottom: spacing.lg },
  themeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'flex-start',
  },
  themeCardActive: {
    backgroundColor: colors.cream,
    borderColor: colors.sunrise,
  },
  themeEmoji: { fontSize: 28, marginBottom: spacing.xs },
  themeLabel: { ...typography.bodyBold, color: colors.ink, marginBottom: 2 },
  themeTagline: { ...typography.caption, color: colors.sand, lineHeight: 18 },
  timeButton: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.sunrise,
    alignItems: 'center',
  },
  timeButtonText: { fontSize: 56, color: colors.ink, fontWeight: '700', marginBottom: spacing.xs },
  timeButtonHint: { ...typography.caption, color: colors.sand },
  buttonRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: spacing.lg },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  buttonFlex: { flex: 1 },
  buttonPrimary: { backgroundColor: colors.sunrise, flex: 1 },
  buttonSecondary: { backgroundColor: colors.divider, flex: 1 },
  buttonText: { color: colors.cream, ...typography.bodyBold },
  buttonTextSecondary: { color: colors.ink },
});
