// App.tsx: startup, app-wide state and the navigator.
// Morning flow: Wake → Reveal → Verify → Success → Home.
// Home links to Settings, History, Alarms and Premium.
// Screens live in src/screens; this file owns the shared state they act on.

import { useEffect, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  openDatabase,
  getStreak,
  updateStreak,
  getStreakHistory,
  getAllChains,
  updateHabitChain,
  recordCompletion,
  recordAlarmFire,
  resetAllData,
  getSetting,
  setSetting,
  addJournalEntry,
  getJournalEntries,
  formatJournalExport,
  type JournalEntry,
  type DayHistory,
  type Streak,
  type HabitChain,
  type Task,
} from './src/db/database';
import type { NextAlarm } from './src/services/scheduleHelper';
import { syncAlarms, type AlarmSyncResult } from './src/services/alarmSync';
import { nextStreak } from './src/services/streak';
import { localDateKey } from './src/utils/dates';
import { errorMessage } from './src/utils/errors';
import { pickDailyTask, type PickResult } from './src/services/dailyPick';
import {
  scheduleAlarm,
  initAlarmService,
  restoreAlarmsOnAppStart,
  setOnAlarmFireCallback,
  stopAlarmSound,
  ALARM_SOUND_SETTING_KEY,
  addNativeAlarmListener,
  openFullScreenAlarmSettings,
  openDisplayOverAppsSettings,
  isCheckInAlarm,
  scheduleCheckIn,
  cancelCheckIn,
} from './src/services/alarm';
import { scheduleBedtimeReminder, cancelBedtimeReminder } from './src/services/bedtime';
import { initSubscriptionService, getSubscriptionStatus, type SubscriptionTier } from './src/services/subscription';
import { openAppSettings } from './src/services/systemSettings';
import { useLockScreenAccess } from './src/hooks/useLockScreenAccess';
import { navigationRef, navigate, goBack, type RootStackParamList } from './src/navigation/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { TaskRevealScreen } from './src/screens/TaskRevealScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AlarmsListScreen } from './src/screens/AlarmsListScreen';
import { EditAlarmScreen } from './src/screens/EditAlarmScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { RingingScreen } from './src/screens/morning/RingingScreen';
import { SunTapScreen } from './src/screens/morning/SunTapScreen';
import { GoodThingScreen } from './src/screens/morning/GoodThingScreen';
import { DoneScreen } from './src/screens/morning/DoneScreen';
import { CantDoScreen } from './src/screens/morning/CantDoScreen';
import { CheckInScreen } from './src/screens/morning/CheckInScreen';
import { LoadingView, StartupErrorView } from './src/components/StartupStatus';
import {
  initAnalytics,
  stopAnalytics,
  ANALYTICS_CONSENT_KEY,
  type AnalyticsConsent,
  trackEvent,
  trackAlarmScheduled,
  trackTaskCompleted,
  trackTaskSkipped,
  trackTaskSnoozed,
} from './src/services/analytics';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SNOOZE_MINUTES = 5;
const MAX_SNOOZES = 2;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pick, setPick] = useState<PickResult | null>(null);
  const [tomorrowPick, setTomorrowPick] = useState<PickResult | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [chains, setChains] = useState<HabitChain[]>([]);
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [nextAlarm, setNextAlarm] = useState<NextAlarm | null>(null);
  const [alarmStatus, setAlarmStatus] = useState<AlarmSyncResult['status'] | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [lastStreakCount, setLastStreakCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  // Time to start a new alarm at, when it comes from the sunrise card.
  const [editingInitialTime, setEditingInitialTime] = useState<string | null>(null);
  const [preferredTheme, setPreferredTheme] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<string>('default');
  const [bedtime, setBedtime] = useState<string>('22:30');
  const [bedtimeEnabled, setBedtimeEnabled] = useState<boolean>(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [alarmHelpDismissed, setAlarmHelpDismissed] = useState(false);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>(null);
  // This morning's flow: snoozes used, the saved line, the ritual shown on
  // "Done", and when the "Still up?" check will ring.
  const [snoozesUsed, setSnoozesUsed] = useState(0);
  const [savedLine, setSavedLine] = useState('');
  const [doneRitual, setDoneRitual] = useState<Task | null>(null);
  const [checkInAt, setCheckInAt] = useState<Date | null>(null);

  const lockScreen = useLockScreenAccess();

  // A ringing alarm that asked for its screen before navigation was ready
  // (during startup the loading screen is shown, so navigate() would no-op).
  const pendingWakeRef = useRef<'Wake' | 'CheckIn' | null>(null);

  // The "Still up?" follow-up opens its own screen; every other alarm opens
  // the ringing screen.
  const goToWake = (taskId?: string | null) => {
    const route = isCheckInAlarm(taskId) ? 'CheckIn' : 'Wake';
    if (navigationRef.isReady()) {
      navigationRef.navigate(route);
    } else {
      pendingWakeRef.current = route;
    }
  };

  // An alarm that fires while the app is already open (warm start).
  useEffect(() => addNativeAlarmListener((taskId) => goToWake(taskId)), []);

  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  const pickFor = (tier: SubscriptionTier, theme: string | null) =>
    pickDailyTask({ tier, theme: theme ?? undefined });

  // Startup
  useEffect(() => {
    (async () => {
      try {
        await openDatabase();
        // Analytics only after the user opted in (asked once on Home).
        const consent = (await getSetting(ANALYTICS_CONSENT_KEY)) as AnalyticsConsent;
        setAnalyticsConsent(consent === 'granted' || consent === 'denied' ? consent : null);
        await initAnalytics(consent);
        trackEvent('App_Open');
        await initAlarmService();
        // Whatever fires the alarm (native AlarmManager, expo-notifications or a
        // JS timer) opens the wake screen, the only screen that stops the sound
        // once the ritual is done.
        setOnAlarmFireCallback((taskId) => goToWake(taskId));
        // Recovery: handle missed alarms, re-queue pending ones, and detect an
        // alarm the native module fired while the app was closed.
        const restore = await restoreAlarmsOnAppStart();
        if (restore.missed > 0 || restore.rescheduled > 0 || restore.coldStartFired) {
          console.log(
            `[bootstrap] alarm recovery: missed=${restore.missed}, rescheduled=${restore.rescheduled}, coldStartFired=${restore.coldStartFired}`
          );
        }
        // Ringing now: open the wake screen as soon as navigation is ready.
        if (restore.coldStartFired) goToWake(restore.coldStartTaskId);
        await lockScreen.refresh();
        await initSubscriptionService();
        const { tier } = await getSubscriptionStatus();
        setSubscriptionTier(tier);
        const theme = await getSetting('preferred_theme');
        setPreferredTheme(theme);
        setSelectedSound((await getSetting(ALARM_SOUND_SETTING_KEY)) ?? 'default');
        setBedtime((await getSetting('bedtime')) ?? '22:30');
        setBedtimeEnabled((await getSetting('bedtime_enabled')) === '1');
        setAlarmHelpDismissed((await getSetting('alarm_sound_help_dismissed')) === '1');
        const today = await pickFor(tier, theme);
        setPick(today);
        const s = await getStreak();
        setStreak(s);
        setChains(await getAllChains());
        setHistory(await getStreakHistory(7));
        setJournal(await getJournalEntries(5));
        // Make sure the OS has the next alarm queued. No permission prompt here:
        // the home screen shows a clear "Allow" action if it's needed.
        applySyncResult(await syncAlarms(today.task));
        // Onboarding is for people who haven't finished it, and a ringing alarm
        // always takes priority.
        const onboarded = (await getSetting('onboarding_complete')) === '1' || s.totalCompleted > 0;
        if (!onboarded && !restore.coldStartFired) setShowOnboarding(true);
        setTomorrowPick(await pickFor(tier, theme));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshProgress = async () => {
    setStreak(await getStreak());
    setChains(await getAllChains());
    setHistory(await getStreakHistory(7));
    setJournal(await getJournalEntries(5));
  };

  function applySyncResult(result: AlarmSyncResult) {
    setAlarmStatus(result.status);
    setNextAlarm(result.status === 'none' ? null : result.next);
    if (result.status === 'scheduled') {
      trackAlarmScheduled({
        time: result.next.date.toISOString(),
        taskTheme: 'n/a',
        smartWakeWindow: result.next.alarm.smartWakeWindow,
      });
    } else if (result.status === 'error') {
      console.warn(`[alarm] could not schedule: ${result.message}`);
    }
  }

  /**
   * Re-schedule the next alarm with the OS. Called after any alarm change and
   * after each morning. `askPermission` is true when the user has just acted,
   * so a permission prompt appears in context.
   */
  const resyncAlarms = async (askPermission: boolean, ritual: Task | undefined = pick?.task) => {
    if (!ritual) return;
    applySyncResult(await syncAlarms(ritual, { askPermission }));
  };

  // "Allow" on the home-screen warning: ask once, then send the user to the
  // app's settings page if Android won't show the prompt again.
  const onFixAlarmPermission = async () => {
    if (!pick) return;
    const result = await syncAlarms(pick.task, { askPermission: true });
    applySyncResult(result);
    if (result.status === 'needs-permission') await openAppSettings();
  };

  const onRevealNow = async () => {
    if (!pick) return;
    try {
      setCurrentHistoryId(await recordAlarmFire(pick.task.id, new Date().toISOString()));
      navigate('Reveal');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  /**
   * Record a finished morning: history row, streak, chain, next ritual, and the
   * next alarm queued. Returns false if it couldn't (the error screen shows).
   */
  const completeMorning = async (verificationData: { kind: string; [k: string]: unknown }): Promise<boolean> => {
    if (!pick || !streak) return false;
    try {
      const now = new Date().toISOString();
      // A real alarm opens the app straight into the wake flow, so there may
      // be no history row yet; without one the completion was silently dropped.
      const historyId = currentHistoryId ?? (await recordAlarmFire(pick.task.id, now));
      await recordCompletion(historyId, now, 'completed', verificationData);
      trackTaskCompleted({ taskTheme: pick.task.theme, verificationMode: pick.task.verification });
      // The ritual is verified done: this is the only place the "complete" path
      // stops the alarm, so it keeps ringing through verification.
      await stopAlarmSound();

      const next = nextStreak(streak, localDateKey());
      const updated: Partial<Streak> = {
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastCompletedDate: next.lastCompletedDate,
        totalCompleted: next.totalCompleted,
      };
      await updateStreak(updated);
      setLastStreakCount(next.currentStreak);
      setStreak({ ...streak, ...updated });
      await updateHabitChain(pick.task.theme);
      await refreshProgress();
      setPick(tomorrowPick);
      setTomorrowPick(await pickFor(subscriptionTier, preferredTheme));
      // Queue the next ring (tomorrow, next weekday...) with tomorrow's ritual.
      await resyncAlarms(false, (tomorrowPick ?? pick).task);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  // The older ritual-with-proof path (Home → Reveal → Verify).
  const onComplete = async (verificationData: { kind: string; [k: string]: unknown }) => {
    if (await completeMorning(verificationData)) navigate('Success');
  };

  // New morning flow, step 3 saved: journal line, morning recorded, alarm off,
  // then the "Still up?" check booked for 10 minutes from now.
  const onGoodThingSaved = async (line: string) => {
    const ritual = pick?.task ?? null;
    setSavedLine(line);
    setDoneRitual(ritual);
    try {
      await addJournalEntry(line, 'wake');
    } catch (e) {
      console.warn(`[journal] could not save: ${errorMessage(e)}`);
    }
    const ok = await completeMorning({ kind: 'checkin', text: line });
    if (!ok) return;
    setSnoozesUsed(0);
    setCheckInAt(await scheduleCheckIn());
    navigate('Done');
  };

  // "I can't do this today": alarm off without the check. Not counted as a
  // completed morning, but the "Still up?" check still runs.
  const onCantDoTurnOff = async () => {
    await stopAlarmSound();
    if (pick) {
      try {
        const now = new Date().toISOString();
        const historyId = currentHistoryId ?? (await recordAlarmFire(pick.task.id, now));
        await recordCompletion(historyId, now, 'skipped');
        trackTaskSkipped({ taskTheme: pick.task.theme });
      } catch {
        // Recording is best effort; the alarm is already off.
      }
    }
    setSnoozesUsed(0);
    setCurrentHistoryId(null);
    await resyncAlarms(false);
    setCheckInAt(await scheduleCheckIn());
    navigate('Home');
  };

  const onCheckInUp = async () => {
    await stopAlarmSound();
    await cancelCheckIn();
    setCheckInAt(null);
    navigate('Home');
  };

  const onFinishDone = async () => {
    setCurrentHistoryId(null);
    navigate('Home');
    await refreshProgress();
  };

  const onSkip = async () => {
    if (currentHistoryId) {
      try {
        await recordCompletion(currentHistoryId, new Date().toISOString(), 'skipped');
        trackTaskSkipped({ taskTheme: pick?.task.theme ?? 'unknown' });
      } catch {
        // Recording the skip is best effort; silencing the alarm is not.
      }
    }
    await stopAlarmSound();
    await resyncAlarms(false);
    navigate('Home');
  };

  const onSnooze = async () => {
    if (!pick || snoozesUsed >= MAX_SNOOZES) return;
    setSnoozesUsed((n) => n + 1);
    await stopAlarmSound();
    const snoozeFor = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000);
    scheduleAlarm(snoozeFor, pick.task.id, pick.task.text, 0).catch((e) => console.error(e));
    trackTaskSnoozed({ taskTheme: pick.task.theme, snoozeDurationMins: SNOOZE_MINUTES });
    navigate('Home');
    Alert.alert('Snoozed', `Back to sleep. We'll try again in ${SNOOZE_MINUTES} minutes.`);
  };

  const onDone = async () => {
    navigate('Home');
    setCurrentHistoryId(null);
    await refreshProgress();
  };

  // The user's answer to "share anonymous usage counts?" (Home card or Settings).
  const onChangeAnalyticsConsent = async (granted: boolean) => {
    const value: AnalyticsConsent = granted ? 'granted' : 'denied';
    setAnalyticsConsent(value);
    await setSetting(ANALYTICS_CONSENT_KEY, value);
    if (granted) await initAnalytics('granted');
    else await stopAnalytics();
  };

  // Your words are yours: share the whole journal as plain text (email, notes, Drive...).
  const onExportJournal = async () => {
    const entries = await getJournalEntries(10_000);
    if (entries.length === 0) {
      Alert.alert('Nothing to export yet', 'Your journal fills up one line each morning.');
      return;
    }
    await Share.share({ title: 'My KindRise journal', message: formatJournalExport(entries) });
  };

  const onDismissAlarmHelp = async () => {
    await setSetting('alarm_sound_help_dismissed', '1');
    setAlarmHelpDismissed(true);
  };

  const onSaveThemePreference = async (theme: string | null) => {
    setPreferredTheme(theme);
    await setSetting('preferred_theme', theme ?? '');
    setPick(await pickFor(subscriptionTier, theme));
    setTomorrowPick(await pickFor(subscriptionTier, theme));
  };

  const onSaveSound = async (soundId: string) => {
    setSelectedSound(soundId);
    await setSetting(ALARM_SOUND_SETTING_KEY, soundId);
  };

  const onSaveBedtime = async (time: string, enabled: boolean) => {
    setBedtime(time);
    setBedtimeEnabled(enabled);
    await setSetting('bedtime', time);
    await setSetting('bedtime_enabled', enabled ? '1' : '0');
    await cancelBedtimeReminder();
    if (enabled) {
      try {
        await scheduleBedtimeReminder(time);
      } catch (e) {
        console.warn(`[bedtime] could not schedule: ${errorMessage(e)}`);
      }
    }
  };

  const onResetAllData = async () => {
    await resetAllData();
    setStreak(await getStreak());
    setPick(await pickFor(subscriptionTier, preferredTheme));
    setTomorrowPick(null);
    navigate('Home');
    setShowOnboarding(true);
  };

  const onOnboardingComplete = async () => {
    const theme = await getSetting('preferred_theme');
    setPreferredTheme(theme);
    const result = await pickFor(subscriptionTier, theme);
    setPick(result);
    // Onboarding just created the first alarm: schedule it now and ask for
    // notification permission while the user is engaged.
    await resyncAlarms(true, result.task);
    setShowOnboarding(false);
    // Android: ask in context for what lets the alarm open over the lock
    // screen. "Display over other apps" first: some skins (OriginOS, MIUI)
    // reject full-screen notifications even when allowed, and report them as
    // allowed.
    const access = await lockScreen.refresh();
    if (!access.overlay) {
      Alert.alert(
        'Let your alarm wake you properly',
        'Allow KindRise to display over other apps. When your alarm rings, it can then open your morning ritual over the lock screen instead of hiding in your notifications.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Allow', onPress: () => void openDisplayOverAppsSettings() },
        ]
      );
    } else if (!access.fullScreen) {
      Alert.alert(
        'Let your alarm wake you properly',
        'Allow KindRise to show full-screen notifications, so your alarm opens over the lock screen instead of hiding in your notifications.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Allow', onPress: () => void openFullScreenAlarmSettings() },
        ]
      );
    }
  };

  const onRetryStartup = async () => {
    setLoading(true);
    setError(null);
    try {
      await openDatabase();
      await restoreAlarmsOnAppStart();
      setPick(await pickFor(subscriptionTier, preferredTheme));
      setStreak(await getStreak());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---

  if (!fontsLoaded || loading) return <LoadingView />;
  if (error) return <StartupErrorView message={error} onRetry={onRetryStartup} />;
  if (!pick || !streak) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const route = pendingWakeRef.current;
        if (route) {
          pendingWakeRef.current = null;
          navigationRef.navigate(route);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {showOnboarding ? (
          <Stack.Screen name="Onboarding">{() => <OnboardingFlow onComplete={onOnboardingComplete} />}</Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home">
              {() => (
                <HomeScreen
                  pick={pick}
                  streak={streak}
                  chains={chains}
                  history={history}
                  journal={journal}
                  analyticsConsent={analyticsConsent}
                  onAnalyticsConsent={(granted) => void onChangeAnalyticsConsent(granted)}
                  alarmStatus={alarmStatus}
                  nextAlarm={nextAlarm}
                  lockScreenAccessMissing={lockScreen.missing}
                  alarmHelpDismissed={alarmHelpDismissed}
                  onDismissAlarmHelp={onDismissAlarmHelp}
                  onFixAlarmPermission={onFixAlarmPermission}
                  onRetryAlarm={() => void resyncAlarms(true)}
                  onFixLockScreenAccess={() => void lockScreen.fix()}
                  onRevealNow={onRevealNow}
                  onSetAlarmAt={(time) => {
                    setEditingAlarmId(null);
                    setEditingInitialTime(time);
                    navigate('EditAlarm');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Wake" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => (
                <RingingScreen
                  snoozesLeft={MAX_SNOOZES - snoozesUsed}
                  onStart={() => navigate('SunTap')}
                  onSnooze={() => void onSnooze()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SunTap" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => <SunTapScreen onDone={() => navigate('GoodThing')} onCantDo={() => navigate('CantDo')} />}
            </Stack.Screen>
            <Stack.Screen name="GoodThing" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => <GoodThingScreen onSave={(line) => void onGoodThingSaved(line)} />}
            </Stack.Screen>
            <Stack.Screen name="Done" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => (
                <DoneScreen
                  line={savedLine}
                  streakCount={lastStreakCount}
                  ritual={doneRitual}
                  checkInAt={checkInAt}
                  onRitualDone={() => {
                    trackEvent('Ritual_Done_After_Wake', { taskTheme: doneRitual?.theme ?? 'unknown' });
                    void onFinishDone();
                  }}
                  onLater={() => void onFinishDone()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="CantDo" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => <CantDoScreen onTurnOff={() => void onCantDoTurnOff()} onBack={() => navigate('SunTap')} />}
            </Stack.Screen>
            <Stack.Screen name="CheckIn" options={{ gestureEnabled: false, animation: 'fade' }}>
              {() => <CheckInScreen onUp={() => void onCheckInUp()} />}
            </Stack.Screen>
            <Stack.Screen name="Reveal" options={{ gestureEnabled: false }}>
              {() => (
                <TaskRevealScreen
                  task={pick.task}
                  onStartVerification={() => navigate('Verify')}
                  onSkip={onSkip}
                  onSnoozed={() => navigate('Home')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Verify" options={{ gestureEnabled: false }}>
              {() => <VerificationScreen task={pick.task} onComplete={onComplete} onCancel={() => navigate('Reveal')} />}
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
                  analyticsEnabled={analyticsConsent === 'granted'}
                  onChangeAnalytics={(granted) => void onChangeAnalyticsConsent(granted)}
                  onExportJournal={() => void onExportJournal()}
                  onManageAlarms={() => navigate('AlarmsList')}
                  onUpgrade={() => navigate('Premium')}
                  onBack={goBack}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="AlarmsList" options={{ presentation: 'modal' }}>
              {() => (
                <AlarmsListScreen
                  onBack={goBack}
                  onChanged={() => resyncAlarms(true)}
                  onCreateAlarm={() => {
                    setEditingAlarmId(null);
                    setEditingInitialTime(null);
                    navigate('EditAlarm');
                  }}
                  onEditAlarm={(id) => {
                    setEditingAlarmId(id);
                    navigate('EditAlarm');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="EditAlarm" options={{ presentation: 'modal' }}>
              {() => (
                <EditAlarmScreen
                  alarmId={editingAlarmId}
                  initialTime={editingInitialTime}
                  onBack={goBack}
                  onSave={async () => {
                    goBack();
                    // Saving or deleting an alarm schedules (or clears) it straight away.
                    await resyncAlarms(true);
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="History" options={{ presentation: 'modal' }}>
              {() => <HistoryScreen onBack={goBack} />}
            </Stack.Screen>
            <Stack.Screen name="Premium" options={{ presentation: 'modal' }}>
              {() => (
                <PremiumScreen
                  onClose={goBack}
                  onPurchased={async () => {
                    const { tier } = await getSubscriptionStatus();
                    setSubscriptionTier(tier);
                    setPick(await pickFor(tier, preferredTheme));
                    navigate('Home');
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
