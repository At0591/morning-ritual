// Home: today's ritual, streak, next alarm and anything the alarm still needs.
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { DayHistory, HabitChain, JournalEntry, Streak } from '../db/database';
import { HorizonMark } from '../components/HorizonMark';
import { RitualEvidence } from '../components/RitualEvidence';
import type { PickResult } from '../services/dailyPick';
import { describeNextAlarm, type NextAlarm } from '../services/scheduleHelper';
import type { AlarmSyncResult } from '../services/alarmSync';
import { showOemSetupGuide } from '../services/systemSettings';
import { StreakHistoryDots } from '../components/StreakHistoryDots';
import { OnboardingCard } from '../components/OnboardingCard';
import { DawnTimesCard } from '../components/DawnTimesCard';
import { DebugPanel } from '../components/DebugPanel';
import { getTodayAffirmation } from '../data/affirmations';
import { navigate } from '../navigation/navigation';
import { brand, colors, radius, spacing, typography, themeEmoji } from '../theme';

type Props = {
  pick: PickResult;
  streak: Streak;
  chains: HabitChain[];
  history: DayHistory[];
  journal: JournalEntry[];
  analyticsConsent: 'granted' | 'denied' | null;
  onAnalyticsConsent: (granted: boolean) => void;
  alarmStatus: AlarmSyncResult['status'] | null;
  nextAlarm: NextAlarm | null;
  lockScreenAccessMissing: boolean;
  alarmHelpDismissed: boolean;
  onDismissAlarmHelp: () => void;
  onFixAlarmPermission: () => void;
  onRetryAlarm: () => void;
  onFixLockScreenAccess: () => void;
  onRevealNow: () => void;
  onSetAlarmAt: (time: string) => void;
};

const CHAIN_EMOJI: Record<string, string> = { body: '🧘', mind: '🧠', brain: '💡' };

export function HomeScreen({
  pick,
  streak,
  chains,
  history,
  journal,
  analyticsConsent,
  onAnalyticsConsent,
  alarmStatus,
  nextAlarm,
  lockScreenAccessMissing,
  alarmHelpDismissed,
  onDismissAlarmHelp,
  onFixAlarmPermission,
  onRetryAlarm,
  onFixLockScreenAccess,
  onRevealNow,
  onSetAlarmAt,
}: Props) {
  // The welcome card is for people who haven't finished a ritual yet; "Got it"
  // hides it until the next launch.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = streak.totalCompleted === 0 && !welcomeDismissed;
  const activeChains = chains
    .filter((c) => c.chainCount > 0)
    .sort((a, b) => b.chainCount - a.chainCount)
    .slice(0, 2);
  const warn = alarmStatus === 'needs-permission' || alarmStatus === 'error';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.brandCol}>
          <HorizonMark size={34} sunColor="#E89A2E" lineColor={brand.ink} />
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.appName}>KindRise</Text>
        </View>
        <View style={styles.headerActions}>
          {streak.currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakFlame}>🔥</Text>
              <Text style={styles.streakNum}>{streak.currentStreak}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigate('History')} accessibilityLabel="History">
            <Feather name="clock" size={24} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigate('Settings')} accessibilityLabel="Settings">
            <Feather name="settings" size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      {showWelcome ? <OnboardingCard onDismiss={() => setWelcomeDismissed(true)} /> : null}

      {Platform.OS === 'android' && !alarmHelpDismissed ? (
        <TouchableOpacity style={styles.alarmHelpCard} onPress={showOemSetupGuide} activeOpacity={0.85}>
          <View style={styles.flex}>
            <Text style={styles.alarmHelpTitle}>Make sure your alarm rings</Text>
            <Text style={styles.alarmHelpBody}>
              Some Android phones, such as iQOO, Vivo and Xiaomi, close background apps. Tap to see the settings that keep
              your alarm ringing when the phone is locked.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.alarmHelpDismiss}
            onPress={onDismissAlarmHelp}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.alarmHelpDismissText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      <View style={styles.affirmationCard}>
        <Text style={styles.affirmationLabel}>TODAY'S REFLECTION</Text>
        <Text style={styles.affirmationText}>{getTodayAffirmation()}</Text>
      </View>

      <StreakHistoryDots days={history} streakCount={streak.currentStreak} />

      {activeChains.length > 0 ? (
        <View style={styles.chainCard}>
          {activeChains.map((c) => (
            <View key={c.theme} style={styles.chainRow}>
              <Text style={styles.chainEmoji}>{CHAIN_EMOJI[c.theme] ?? '🎨'}</Text>
              <View style={styles.chainText}>
                <Text style={styles.chainTitle}>
                  {c.chainCount}-day {c.theme} chain
                  {c.earnedBadge ? ' 🏆' : ''}
                </Text>
                <Text style={styles.chainProgress}>
                  {c.earnedBadge
                    ? 'You got the Champion badge'
                    : c.chainCount >= 7
                    ? 'One more day for the badge'
                    : `${7 - c.chainCount} to go for the Champion badge`}
                </Text>
              </View>
              <View style={styles.chainDots}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <View key={day} style={[styles.chainDot, day <= c.chainCount && styles.chainDotFilled]} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Today's ritual</Text>
          <Text style={styles.cardTheme}>
            {themeEmoji(pick.task.theme)} {pick.task.theme}
          </Text>
        </View>
        <Text style={styles.cardText}>{pick.task.text}</Text>
        <Text style={styles.cardMeta}>
          Optional, about {pick.task.estSeconds < 60 ? `${pick.task.estSeconds} seconds` : `${Math.round(pick.task.estSeconds / 60)} min`}
        </Text>
        <RitualEvidence task={pick.task} />
      </View>

      {/* Alarm status: always says whether the OS really has an alarm queued. */}
      <View style={[styles.alarmRow, warn ? styles.alarmRowWarn : null]}>
        <View style={styles.flex}>
          <Text style={styles.alarmLabel}>
            {alarmStatus === 'scheduled' && nextAlarm
              ? 'Next alarm'
              : alarmStatus === 'needs-permission'
              ? "Your alarm can't ring yet"
              : alarmStatus === 'error'
              ? "Couldn't set your alarm"
              : 'No alarm on'}
          </Text>
          <Text style={styles.alarmValue}>
            {alarmStatus === 'scheduled' && nextAlarm
              ? describeNextAlarm(nextAlarm.date)
              : alarmStatus === 'needs-permission'
              ? 'Allow notifications so it can wake you.'
              : alarmStatus === 'error'
              ? 'Tap Retry, or check alarm permissions in Settings.'
              : 'Add an alarm to get started.'}
          </Text>
        </View>
        {alarmStatus === 'needs-permission' ? (
          <TouchableOpacity style={styles.smallBtn} onPress={onFixAlarmPermission} accessibilityRole="button">
            <Text style={styles.smallBtnText}>Allow</Text>
          </TouchableOpacity>
        ) : alarmStatus === 'error' ? (
          <TouchableOpacity style={styles.smallBtn} onPress={onRetryAlarm} accessibilityRole="button">
            <Text style={styles.smallBtnText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.timeButton} onPress={() => navigate('AlarmsList')} accessibilityRole="button">
            <Text style={styles.timeButtonText}>{nextAlarm ? 'Edit' : 'Add alarm'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {alarmStatus === 'scheduled' && lockScreenAccessMissing ? (
        <View style={[styles.alarmRow, styles.alarmRowWarn]}>
          <View style={styles.flex}>
            <Text style={styles.alarmLabel}>One more permission</Text>
            <Text style={styles.alarmValue}>Let your alarm open over the lock screen.</Text>
          </View>
          <TouchableOpacity style={styles.smallBtn} onPress={onFixLockScreenAccess} accessibilityRole="button">
            <Text style={styles.smallBtnText}>Allow</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <DawnTimesCard onSetAlarm={onSetAlarmAt} />

      {analyticsConsent === null ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>HELP IMPROVE THE APP?</Text>
          <Text style={styles.consentBody}>
            Share anonymous usage counts, like how many mornings the alarm was turned off. Never your journal or anything
            you type. You can change this in Settings.
          </Text>
          <View style={styles.consentRow}>
            <TouchableOpacity style={[styles.smallBtn, styles.flex]} onPress={() => onAnalyticsConsent(true)} accessibilityRole="button">
              <Text style={styles.smallBtnText}>Yes, share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.consentNo, styles.flex]} onPress={() => onAnalyticsConsent(false)} accessibilityRole="button">
              <Text style={styles.consentNoText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {journal.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR JOURNAL</Text>
          {journal.slice(0, 3).map((e) => (
            <View key={e.id} style={styles.journalRow}>
              <Text style={styles.journalText}>{e.text}</Text>
              <Text style={styles.journalDate}>{e.dateKey}</Text>
            </View>
          ))}
        </View>
      ) : null}

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

      {__DEV__ ? (
        <DebugPanel candidatePoolSize={pick.candidatePoolSize} excludedByRepeat={pick.excludedByRepeat} />
      ) : null}

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brandCol: { flexShrink: 1, gap: 2 },
  consentBody: { ...typography.body, color: colors.ink, marginTop: spacing.xs },
  consentRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  consentNo: { borderWidth: 1.5, borderColor: colors.divider, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  consentNoText: { ...typography.bodyBold, color: colors.ink },
  journalRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  journalText: { ...typography.body, color: colors.ink },
  journalDate: { ...typography.caption, color: colors.sand, marginTop: 2 },
  scroll: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
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
    backgroundColor: '#FBEFDD',
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
  alarmRowWarn: {
    backgroundColor: '#FBEFDD',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  alarmLabel: {
    ...typography.caption,
    color: colors.sand,
  },
  alarmValue: {
    ...typography.bodyBold,
    color: colors.ink,
    marginTop: 2,
    marginRight: spacing.sm,
  },
  timeButton: {
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
  smallBtnText: {
    color: '#fff',
    ...typography.bodyBold,
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
  affirmationCard: {
    backgroundColor: '#FBEFDD',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#EFDDBF',
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
  alarmHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBEFDD',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E3B26A',
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
