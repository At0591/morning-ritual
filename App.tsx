// App.tsx — Phase 3: Settings + History + Time picker + Tomorrow preview
// Home → TaskReveal → Verification → Success → Home
// Plus: Settings, History (reached from home header buttons)

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  openDatabase,
  getStreak,
  updateStreak,
  getStreakHistory,
  getAllTasks,
  getAllChains,
  updateHabitChain,
  DayHistory,
  Streak,
  HabitChain,
  recordCompletion,
  recordAlarmFire,
  Task,
  resetAllData,
  getAllAlarms,
  Alarm
} from './src/db/database';
import { getNextAlarmOccurrence } from './src/services/scheduleHelper';
import { pickDailyTask, PickResult } from './src/services/dailyPick';
import {
  scheduleAlarm,
  initAlarmService,
  restoreAlarmsOnAppStart,
  setOnAlarmFireCallback,
  fireImmediateNotification,
  fireDelayedNotification,
  getScheduledAlarms,
  cancelAllAlarms,
  stopAlarmSound,
  PRE_WAKE_WINDOW_SETTING_KEY,
} from './src/services/alarm';
import { scheduleBedtimeReminder, cancelBedtimeReminder } from './src/services/bedtime';
import {
  initSubscriptionService,
  getSubscriptionStatus,
  type SubscriptionTier,
} from './src/services/subscription';
import { TaskRevealScreen } from './src/screens/TaskRevealScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AlarmsListScreen } from './src/screens/AlarmsListScreen';
import { EditAlarmScreen } from './src/screens/EditAlarmScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { StreakHistoryDots } from './src/components/StreakHistoryDots';
import { OnboardingCard } from './src/components/OnboardingCard';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { WakeUpScreen } from './src/screens/WakeUpScreen';
import { colors, radius, spacing, typography, themeEmoji } from './src/theme';
import { getTodayAffirmation } from './src/data/affirmations';
import {
  initAnalytics,
  trackEvent,
  trackAlarmScheduled,
  trackTaskCompleted,
  trackTaskSkipped,
  trackTaskSnoozed
} from './src/services/analytics';

export const navigationRef = createNavigationContainerRef<any>();
const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  
  const [pick, setPick] = useState<PickResult | null>(null);
  const [tomorrowPick, setTomorrowPick] = useState<PickResult | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [chains, setChains] = useState<HabitChain[]>([]);
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [nextAlarm, setNextAlarm] = useState<{ alarm: Alarm; date: Date } | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [lastStreakCount, setLastStreakCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [preferredTheme, setPreferredTheme] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<string>('default');
  const [bedtime, setBedtime] = useState<string>('22:30');
  const [bedtimeEnabled, setBedtimeEnabled] = useState<boolean>(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [alarmSoundHelpDismissed, setAlarmSoundHelpDismissed] = useState(false);

  const [fontsLoaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        await initAnalytics();
        trackEvent('App_Open');
        await openDatabase();
        await initAlarmService();
        // Register the alarm-fire callback so when any mechanism fires the
        // alarm (JS timer, expo-notifications, native AlarmManager), we
        // navigate to WakeUpScreen — which is the only screen that calls
        // stopAlarmSound() when the user completes the task.
        setOnAlarmFireCallback((taskId, _taskText) => {
          navigationRef.isReady() && navigationRef.navigate('Wake');
        });
        // Recovery net: fire missed alarms + re-schedule pending ones
        // from the SQLite queue + check for cold-start alarm fired by the
        // native module while the app was killed.
        const restore = await restoreAlarmsOnAppStart();
        if (restore.missed > 0 || restore.rescheduled > 0 || restore.coldStartFired) {
          console.log(`[bootstrap] alarm recovery: missed=${restore.missed}, rescheduled=${restore.rescheduled}, coldStartFired=${restore.coldStartFired}`);
        }
        // If the native module reports a cold-start fired alarm, route
        // to WakeUpScreen so the user can complete the task. The notification
        // already woke the phone and played the alarm sound.
        if (restore.coldStartFired) {
          navigationRef.isReady() && navigationRef.navigate('Wake');
        }
        await initSubscriptionService();
        const subStatus = await getSubscriptionStatus();
        setSubscriptionTier(subStatus.tier);
        const theme = await getSetting('preferred_theme');
        setPreferredTheme(theme);
        const sound = await getSetting('alarm_sound');
        setSelectedSound(sound ?? 'default');
        const bt = await getSetting('bedtime');
        setBedtime(bt ?? '22:30');
        const btEnabled = await getSetting('bedtime_enabled');
        setBedtimeEnabled(btEnabled === '1');
        const alarmHelpDismissed = await getSetting('alarm_sound_help_dismissed');
        setAlarmSoundHelpDismissed(alarmHelpDismissed === '1');
        const result = await pickDailyTask({ tier: subStatus.tier, theme: theme ?? undefined });
        setPick(result);
        const s = await getStreak();
        setStreak(s);
        const c = await getAllChains();
        setChains(c);
        const h = await getStreakHistory(7);
        setHistory(h);
        const alarmsData = await getAllAlarms();
        setNextAlarm(getNextAlarmOccurrence(alarmsData));
        if (s.totalCompleted === 0) {
          setShowOnboarding(true);
        }
        const tomorrow = await pickDailyTask({ tier: 'free', theme: theme ?? undefined });
        setTomorrowPick(tomorrow);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshData = async () => {
    const s = await getStreak();
    setStreak(s);
    const c = await getAllChains();
    setChains(c);
    const h = await getStreakHistory(7);
    setHistory(h);
    const alarmsData = await getAllAlarms();
    setNextAlarm(getNextAlarmOccurrence(alarmsData));
  };

  const onSchedule = async () => {
    if (!pick || !nextAlarm) {
      if (!nextAlarm) Alert.alert('No enabled alarms', 'Please create and enable an alarm first.');
      return;
    }
    setScheduling(true);
    try {
      const fireAt = nextAlarm.date;
      const historyId = await recordAlarmFire(pick.task.id, new Date().toISOString());
      setCurrentHistoryId(historyId);
      const windowToUse = nextAlarm.alarm.smartWakeWindow;
      await scheduleAlarm(fireAt, pick.task.id, pick.task.text, windowToUse);
      setScheduledFor(fireAt);
      trackAlarmScheduled({
        time: fireAt.toISOString(),
        taskTheme: pick.task.theme,
        smartWakeWindow: windowToUse,
      });
      const now = new Date();
      const secondsUntil = Math.round((fireAt.getTime() - now.getTime()) / 1000);
      Alert.alert(
        '✓ Alarm set',
        `For ${fireAt.toLocaleString()}\n` +
        `(${secondsUntil}s from now)\n\n` +
        `If it doesn't fire:\n` +
        `• Tap "List scheduled" to verify the OS has it\n` +
        `• Check Settings → Apps → Morning Ritual → Notifications ON\n` +
        `• Some phones (Xiaomi/OnePlus/Realme) need "Auto-start" enabled`
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
      Alert.alert(
        '⚠️ Alarm not set',
        `${e?.message ?? 'Unknown error'}\n\nIf you see "use a development build", grant notification permission in:\nSettings → Apps → Morning Ritual → Notifications`
      );
    } finally {
      setScheduling(false);
    }
  };

  const onRevealNow = async () => {
    if (!pick) return;
    try {
      const historyId = await recordAlarmFire(pick.task.id, new Date().toISOString());
      setCurrentHistoryId(historyId);
      navigationRef.isReady() && navigationRef.navigate('Reveal');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onComplete = async (verificationData: { kind: string; [k: string]: unknown }) => {
    if (!pick || !streak || !currentHistoryId) return;
    try {
      const now = new Date().toISOString();
      await recordCompletion(currentHistoryId, now, 'completed', verificationData);
      trackTaskCompleted({
        taskTheme: pick.task.theme,
        verificationMode: pick.task.verification,
      });
      // The task is genuinely verified done — stop the alarm sound NOW.
      // This is the ONLY place the alarm is stopped on the "complete" path.
      // The user could have tapped "I'm doing it" on WakeUpScreen long ago
      // and we kept the sound going all the way through the verification
      // flow to prevent them from cheating.
      await stopAlarmSound();

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400_000).toISOString().split('T')[0];
      const twoDaysAgo = new Date(Date.now() - 2 * 86400_000).toISOString().split('T')[0];
      const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString().split('T')[0];

      let newCurrent: number;
      let usedGraceDay = false;
      if (streak.lastCompletedDate === today) {
        newCurrent = streak.currentStreak; // already counted today
      } else if (streak.lastCompletedDate === yesterday) {
        newCurrent = streak.currentStreak + 1;
      } else if (streak.lastCompletedDate === twoDaysAgo && streak.graceDays >= 1) {
        // 1 day missed, but grace period covers it
        newCurrent = streak.currentStreak + 1;
        usedGraceDay = true;
      } else if (streak.lastCompletedDate === threeDaysAgo && streak.graceDays >= 2) {
        // 2 days missed, but grace period covers it
        newCurrent = streak.currentStreak + 1;
        usedGraceDay = true;
      } else {
        newCurrent = 1; // gap too big → reset
      }
      const newLongest = Math.max(streak.longestStreak, newCurrent);
      const updated: Partial<Streak> = {
        currentStreak: newCurrent,
        longestStreak: newLongest,
        lastCompletedDate: today,
        totalCompleted: streak.totalCompleted + 1,
      };
      await updateStreak(updated);
      setLastStreakCount(newCurrent);
      setStreak({ ...streak, ...updated });
      // Update habit chain for this theme
      const chainResult = await updateHabitChain(pick.task.theme);
      if (chainResult.justCompleted) {
        // Could trigger a special celebration for chain completion
        // For now, just refresh — the success screen will show the streak update
      }
      await refreshData();
      setPick(tomorrowPick);
      const newTomorrow = await pickDailyTask({ tier: 'free', theme: preferredTheme ?? undefined });
      setTomorrowPick(newTomorrow);
      navigationRef.isReady() && navigationRef.navigate('Success');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onSkip = async () => {
    if (currentHistoryId) {
      try {
        await recordCompletion(currentHistoryId, new Date().toISOString(), 'skipped');
        trackTaskSkipped({ taskTheme: pick?.task.theme ?? 'unknown' });
      } catch {}
    }
    // User gave up on the task — silence the alarm so it doesn't keep
    // ringing while they go back to the home screen.
    await stopAlarmSound();
    navigationRef.isReady() && navigationRef.navigate('Home');
  };

  const onDone = async () => {
    navigationRef.isReady() && navigationRef.navigate('Home');
    setCurrentHistoryId(null);
    await refreshData();
  };

  // Open the app's notification settings page (deep-link).
  // On Android this lands on Settings → Apps → Morning Ritual → Notifications
  // where the user can enable the "Ringtone" toggle. The Ringtone toggle is
  // disabled by default on many Chinese OEM skins (iQOO, Vivo, Xiaomi) and
  // must be turned on for notification sounds to play.
  const onOpenNotificationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        // Linking.openSettings() opens the app's settings page
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch (e: any) {
      Alert.alert('Could not open Settings', 'Please open Settings → Apps → Morning Ritual → Notifications manually.');
    }
  };

  // iQOO / Vivo / Xiaomi: walk the user through the auto-start + battery
  // optimization toggles required for the alarm to fire when the phone is
  // locked. There's no public Intent for these on Chinese OEM skins, so we
  // open the app settings page and show a step-by-step guide.
  const onShowIQOOSetupGuide = () => {
    Alert.alert(
      'Make alarms fire on lock screen',
      "iQOO / Vivo / Xiaomi aggressively kill background apps. To make sure the alarm fires when your phone is locked:\n\n" +
      "1. Settings → Apps → Morning Ritual → Auto-launch → ON\n" +
      "2. Settings → Apps → Morning Ritual → Battery → Unrestricted / Don't optimize\n" +
      "3. Settings → Apps → Morning Ritual → Notifications → enable Ringtone\n\n" +
      "These are 3 quick toggles. Tap 'Open settings' to jump there now.",
      [
        { text: 'Open settings', onPress: onOpenNotificationSettings },
        { text: 'Got it', style: 'cancel' },
      ]
    );
  };

  // --- DEBUG: notification isolation tests ---
  const onTestImmediate = async () => {
    try {
      await fireImmediateNotification();
    } catch (e: any) {
      Alert.alert('Immediate test failed', e?.message ?? String(e));
    }
  };
  const onTestDelayed = async () => {
    try {
      await fireDelayedNotification(10);
      Alert.alert('Test scheduled', 'Should fire in 10s. Keep the app open or in background.');
    } catch (e: any) {
      Alert.alert('Delayed test failed', e?.message ?? String(e));
    }
  };
  const onTestMinute = async () => {
    try {
      await fireDelayedNotification(60);
      Alert.alert('Test scheduled', 'Should fire in 60s. Check the phone in 1 min.');
    } catch (e: any) {
      Alert.alert('60s test failed', e?.message ?? String(e));
    }
  };
  const onListScheduled = async () => {
    try {
      const all = await getScheduledAlarms();
      if (all.length === 0) {
        Alert.alert('No scheduled alarms', 'Nothing pending. Schedule one and check again.');
      } else {
        const summary = all
          .map(
            (n) =>
              `• ${n.identifier.slice(-8)}  →  ${new Date(n.fireAt).toLocaleTimeString()}\n   "${n.taskText}..."  ${n.fired ? '✓ fired' : '⏳ pending'}`
          )
          .join('\n\n');
        Alert.alert(`${all.length} scheduled`, summary);
      }
    } catch (e: any) {
      Alert.alert('List failed', e?.message ?? String(e));
    }
  };
  const onCancelAll = async () => {
    try {
      await cancelAllAlarms();
      Alert.alert('Cancelled', 'All scheduled alarms cleared.');
    } catch (e: any) {
      Alert.alert('Cancel failed', e?.message ?? String(e));
    }
  };

  // Settings handlers
  const onSaveThemePreference = async (theme: string | null) => {
    setPreferredTheme(theme);
    if (theme) await setSetting('preferred_theme', theme);
    else await setSetting('preferred_theme', '');
    const result = await pickDailyTask({ tier: 'free', theme: theme ?? undefined });
    setPick(result);
    const tomorrow = await pickDailyTask({ tier: 'free', theme: theme ?? undefined });
    setTomorrowPick(tomorrow);
  };

  const onSaveSound = async (soundId: string) => {
    setSelectedSound(soundId);
    await setSetting('alarm_sound', soundId);
  };

  const onSaveBedtime = async (time: string, enabled: boolean) => {
    setBedtime(time);
    setBedtimeEnabled(enabled);
    await setSetting('bedtime', time);
    await setSetting('bedtime_enabled', enabled ? '1' : '0');
    // Reschedule the bedtime reminder
    await cancelBedtimeReminder();
    if (enabled) {
      try {
        await scheduleBedtimeReminder(time);
      } catch (e) {
        // ignore
      }
    }
  };

  const onSavePreWakeWindow = async (minutes: number) => {
    setPreWakeWindow(minutes);
    await setSetting(PRE_WAKE_WINDOW_SETTING_KEY, minutes.toString());
  };

  const onResetAllData = async () => {
    await resetAllData();
    const s = await getStreak();
    setStreak(s);
    const result = await pickDailyTask({ tier: 'free', theme: preferredTheme ?? undefined });
    setPick(result);
    setTomorrowPick(null);
    navigationRef.isReady() && navigationRef.navigate('Home');
    setShowOnboarding(true);
  };

  // --- Render branches ---

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.sunrise} />
        <Text style={styles.subtext}>Waking up the database…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={async () => {
            setLoading(true);
            setError(null);
            try {
              await openDatabase();
              await restoreAlarmsOnAppStart();
              const result = await pickDailyTask({
                tier: subscriptionTier,
                theme: preferredTheme ?? undefined,
              });
              setPick(result);
              const s = await getStreak();
              setStreak(s);
            } catch (e: any) {
              setError(e?.message ?? String(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!pick || !streak) return null;

  
  const HomeScreen = () => {
    const themeEmojiStr = themeEmoji(pick.task.theme);
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.appName}>Morning Ritual</Text>
          </View>
          <View style={styles.headerActions}>
            {streak.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakFlame}>🔥</Text>
                <Text style={styles.streakNum}>{streak.currentStreak}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigationRef.isReady() && navigationRef.navigate('History')}>
              <Feather name="clock" size={24} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigationRef.isReady() && navigationRef.navigate('Settings')}>
              <Feather name="settings" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {showOnboarding ? null : (
          <OnboardingCard onDismiss={() => setShowOnboarding(false)} />
        )}

        {Platform.OS === 'android' && alarmSoundHelpDismissed ? null : (
          Platform.OS === 'android' ? (
            <TouchableOpacity
              style={styles.alarmHelpCard}
              onPress={onShowIQOOSetupGuide}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.alarmHelpTitle}>⏰ Make sure your alarm fires</Text>
                <Text style={styles.alarmHelpBody}>
                  Some Android phones (iQOO, Vivo, Xiaomi) kill background apps.
                  Tap for 3 quick toggles so the alarm fires when your phone
                  is locked.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.alarmHelpDismiss}
                onPress={async () => {
                  await setSetting('alarm_sound_help_dismissed', '1');
                  setAlarmSoundHelpDismissed(true);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.alarmHelpDismissText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ) : null
        )}

        <View style={styles.affirmationCard}>
          <Text style={styles.affirmationLabel}>TODAY'S REFLECTION</Text>
          <Text style={styles.affirmationText}>{getTodayAffirmation()}</Text>
        </View>

        <StreakHistoryDots days={history} streakCount={streak.currentStreak} />

        {chains.some((c) => c.chainCount > 0) ? (
          <View style={styles.chainCard}>
            {chains
              .filter((c) => c.chainCount > 0)
              .sort((a, b) => b.chainCount - a.chainCount)
              .slice(0, 2)
              .map((c) => (
                <View key={c.theme} style={styles.chainRow}>
                  <Text style={styles.chainEmoji}>
                    {c.theme === 'body' ? '🧘' : c.theme === 'mind' ? '🧠' : c.theme === 'brain' ? '💡' : '🎨'}
                  </Text>
                  <View style={styles.chainText}>
                    <Text style={styles.chainTitle}>
                      {c.chainCount}-day {c.theme} chain
                      {c.earnedBadge ? ' 🏆' : ''}
                    </Text>
                    <Text style={styles.chainProgress}>
                      {c.earnedBadge
                        ? 'Champion — earned!'
                        : c.chainCount >= 7
                        ? 'Almost there!'
                        : `${7 - c.chainCount} to go for the Champion badge`}
                    </Text>
                  </View>
                  <View style={styles.chainDots}>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <View
                        key={day}
                        style={[
                          styles.chainDot,
                          day <= c.chainCount && styles.chainDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Today's task</Text>
            <Text style={styles.cardTheme}>
              {themeEmojiStr} {pick.task.theme}
            </Text>
          </View>
          <Text style={styles.cardText}>{pick.task.text}</Text>
          <Text style={styles.cardMeta}>
            {pick.task.verification === 'media' ? '📷 ' + pick.task.mediaType : '✓ check-in'} · ~{pick.task.estSeconds}s
          </Text>
        </View>

        <View style={styles.alarmRow}>
          <Text style={styles.alarmLabel}>Wake me at</Text>
          <TouchableOpacity style={styles.timeButton} onPress={() => navigationRef.isReady() && navigationRef.navigate('AlarmsList')}>
            <Text style={styles.timeButtonText}>
              {nextAlarm ? nextAlarm.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set alarms'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, (scheduling || scheduledFor || !nextAlarm) && styles.smallBtnDisabled]}
            onPress={onSchedule}
            disabled={scheduling || scheduledFor !== null || !nextAlarm}
          >
            <Text style={styles.smallBtnText}>
              {scheduling ? '…' : scheduledFor ? '✓' : 'Set'}
            </Text>
          </TouchableOpacity>
        </View>

        {scheduledFor ? (
          <Text style={styles.scheduledFor}>
            Alarm set for {scheduledFor.toLocaleString()}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.cta} onPress={onRevealNow} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Reveal today's task</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak.currentStreak}</Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak.longestStreak}</Text>
            <Text style={styles.statLabel}>Longest</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak.totalCompleted}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Pool: {pick.candidatePoolSize} tasks
          {pick.excludedByRepeat > 0 ? ` · ${pick.excludedByRepeat} excluded for variety` : ''}
        </Text>

        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>🔧 Notification Debug</Text>
          <Text style={styles.debugHelp}>
            Tap these to figure out which part is broken.
          </Text>
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

        <StatusBar style="auto" />
      </ScrollView>
    );
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {showOnboarding ? (
          <Stack.Screen name="Onboarding">
            {() => (
              <OnboardingFlow
                onComplete={async () => {
                  const theme = await getSetting('preferred_theme');
                  setPreferredTheme(theme);
                  const alarmsData = await getAllAlarms();
                  setNextAlarm(getNextAlarmOccurrence(alarmsData));
                  const result = await pickDailyTask({
                    tier: subscriptionTier,
                    theme: theme ?? undefined,
                  });
                  setPick(result);
                  setShowOnboarding(false);
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Wake" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => (
                <WakeUpScreen
                  task={pick.task}
                  onComplete={() => {
                    navigationRef.isReady() && navigationRef.navigate('Reveal');
                  }}
                  onSnooze={() => {
                    const snoozeFor = new Date(Date.now() + 5 * 60 * 1000);
                    scheduleAlarm(snoozeFor, pick.task.id, pick.task.text, 0).catch(e => console.error(e));
                    trackTaskSnoozed({ taskTheme: pick.task.theme, snoozeDurationMins: 5 });
                    navigationRef.isReady() && navigationRef.navigate('Home');
                    setScheduledFor(snoozeFor);
                    Alert.alert('Snoozed', "Back to sleep. We'll try again in 5 minutes.");
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Reveal" options={{ gestureEnabled: false }}>
              {() => (
                <TaskRevealScreen
                  task={pick.task}
                  onStartVerification={() => navigationRef.isReady() && navigationRef.navigate('Verify')}
                  onSkip={onSkip}
                  onSnoozed={() => navigationRef.isReady() && navigationRef.navigate('Home')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Verify" options={{ gestureEnabled: false }}>
              {() => (
                <VerificationScreen
                  task={pick.task}
                  onComplete={onComplete}
                  onCancel={() => navigationRef.isReady() && navigationRef.navigate('Reveal')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Success" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => (
                <SuccessScreen
                  streakCount={lastStreakCount}
                  isNewRecord={lastStreakCount === streak.longestStreak && lastStreakCount > 1}
                  tomorrowTask={tomorrowPick?.task ?? null}
                  onDone={onDone}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Settings" options={{ presentation: 'modal' }}>
              {() => (
                <SettingsScreen
                  preferredTheme={preferredTheme}
                  selectedSound={selectedSound}
                  bedtime={bedtime}
                  bedtimeEnabled={bedtimeEnabled}
                  subscriptionTier={subscriptionTier}
                  onChangeTheme={onSaveThemePreference}
                  onChangeSound={onSaveSound}
                  onChangeBedtime={onSaveBedtime}
                  onResetAllData={onResetAllData}
                  onManageAlarms={() => navigationRef.isReady() && navigationRef.navigate('AlarmsList')}
                  onUpgrade={() => navigationRef.isReady() && navigationRef.navigate('Premium')}
                  onBack={() => navigationRef.isReady() && navigationRef.goBack()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="AlarmsList" options={{ presentation: 'modal' }}>
              {() => (
                <AlarmsListScreen
                  onBack={() => navigationRef.isReady() && navigationRef.goBack()}
                  onCreateAlarm={() => {
                    setEditingAlarmId(null);
                    navigationRef.isReady() && navigationRef.navigate('EditAlarm');
                  }}
                  onEditAlarm={(id) => {
                    setEditingAlarmId(id);
                    navigationRef.isReady() && navigationRef.navigate('EditAlarm');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="EditAlarm" options={{ presentation: 'modal' }}>
              {() => (
                <EditAlarmScreen
                  alarmId={editingAlarmId}
                  onBack={() => navigationRef.isReady() && navigationRef.goBack()}
                  onSave={() => {
                    // Force refresh or re-schedule here later
                    navigationRef.isReady() && navigationRef.goBack();
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="History" options={{ presentation: 'modal' }}>
              {() => <HistoryScreen onBack={() => navigationRef.isReady() && navigationRef.goBack()} />}
            </Stack.Screen>
            <Stack.Screen name="Premium" options={{ presentation: 'modal' }}>
              {() => (
                <PremiumScreen
                  onClose={() => navigationRef.isReady() && navigationRef.goBack()}
                  onPurchased={async () => {
                    const subStatus = await getSubscriptionStatus();
                    setSubscriptionTier(subStatus.tier);
                    const result = await pickDailyTask({ tier: subStatus.tier, theme: preferredTheme ?? undefined });
                    setPick(result);
                    navigationRef.isReady() && navigationRef.navigate('Home');
                  }}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Lightweight settings helpers (avoid circular import in db/database)
async function getSetting(key: string): Promise<string | null> {
  const { getSetting: g } = await import('./src/db/database');
  return g(key);
}
async function setSetting(key: string, value: string): Promise<void> {
  const { setSetting: s } = await import('./src/db/database');
  return s(key, value);
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
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
  errorTitle: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  errorEmoji: { fontSize: 64, marginBottom: spacing.md },
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  greeting: {
    ...typography.body,
    color: colors.sand,
  },
  appName: {
    ...typography.title,
    color: colors.ink,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  streakFlame: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  streakNum: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  iconBtnText: {
    fontSize: 18,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardLabel: {
    ...typography.micro,
    color: colors.sand,
  },
  cardTheme: {
    ...typography.caption,
    color: colors.sand,
    textTransform: 'capitalize',
  },
  cardText: {
    ...typography.heading,
    color: colors.ink,
    lineHeight: 30,
    marginBottom: spacing.md,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.sand,
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alarmLabel: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  timeButton: {
    ...typography.bodyBold,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  timeButtonText: {
    ...typography.bodyBold,
    color: colors.ink,
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
  scheduledFor: {
    ...typography.caption,
    color: colors.sand,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ctaText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.title,
    color: colors.ink,
  },
  statLabel: {
    ...typography.micro,
    color: colors.sand,
    marginTop: spacing.xs,
  },
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
  affirmationCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  alarmHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  alarmHelpTitle: {
    ...typography.bodyBold,
    color: colors.ink,
    marginBottom: 2,
  },
  alarmHelpBody: {
    ...typography.caption,
    color: colors.sand,
    lineHeight: 18,
  },
  alarmHelpDismiss: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  alarmHelpDismissText: {
    fontSize: 18,
    color: colors.sand,
    fontWeight: '600',
  },
  affirmationLabel: {
    ...typography.micro,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  affirmationText: {
    ...typography.body,
    color: colors.ink,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  chainCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  chainEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  chainText: {
    flex: 1,
  },
  chainTitle: {
    ...typography.bodyBold,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  chainProgress: {
    ...typography.caption,
    color: colors.sand,
    marginTop: 2,
  },
  chainDots: {
    flexDirection: 'row',
    gap: 3,
  },
  chainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
  },
  chainDotFilled: {
    backgroundColor: colors.sunrise,
  },
});
