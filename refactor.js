const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// 1. Add Navigation imports
code = code.replace(
  "import { StatusBar } from 'expo-status-bar';",
  "import { StatusBar } from 'expo-status-bar';\nimport { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';\nimport { createNativeStackNavigator } from '@react-navigation/native-stack';"
);

// 2. Navigation Ref & Stack definition
code = code.replace(
  "type Screen = 'home' | 'reveal' | 'verify' | 'success' | 'settings' | 'history' | 'premium' | 'wake';",
  "export const navigationRef = createNavigationContainerRef<any>();\nconst Stack = createNativeStackNavigator();"
);

// 3. Remove setScreen state
code = code.replace(
  "const [screen, setScreen] = useState<Screen>('home');",
  ""
);

// 4. Update routing functions
code = code.replace(/setScreen\('wake'\)/g, "navigationRef.isReady() && navigationRef.navigate('Wake')");
code = code.replace(/setScreen\('reveal'\)/g, "navigationRef.isReady() && navigationRef.navigate('Reveal')");
code = code.replace(/setScreen\('success'\)/g, "navigationRef.isReady() && navigationRef.navigate('Success')");
code = code.replace(/setScreen\('home'\)/g, "navigationRef.isReady() && navigationRef.navigate('Home')");
code = code.replace(/setScreen\('premium'\)/g, "navigationRef.isReady() && navigationRef.navigate('Premium')");
code = code.replace(/setScreen\('history'\)/g, "navigationRef.isReady() && navigationRef.navigate('History')");
code = code.replace(/setScreen\('settings'\)/g, "navigationRef.isReady() && navigationRef.navigate('Settings')");
code = code.replace(/setScreen\('verify'\)/g, "navigationRef.isReady() && navigationRef.navigate('Verify')");

// 5. Replace render blocks
const renderStart = code.indexOf("if (screen === 'success') {");
const renderEnd = code.indexOf("function nextOccurrence");

const newRender = `
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
              <Text style={styles.iconBtnText}>📜</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigationRef.isReady() && navigationRef.navigate('Settings')}>
              <Text style={styles.iconBtnText}>⚙️</Text>
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
                        : \`\${7 - c.chainCount} to go for the Champion badge\`}
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
          <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.timeButtonText}>
              {alarmDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, (scheduling || scheduledFor) && styles.smallBtnDisabled]}
            onPress={onSchedule}
            disabled={scheduling || scheduledFor !== null}
          >
            <Text style={styles.smallBtnText}>
              {scheduling ? '…' : scheduledFor ? '✓' : 'Set'}
            </Text>
          </TouchableOpacity>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={alarmDate}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowTimePicker(false);
              if (date) setAlarmDate(date);
            }}
          />
        )}

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
          {pick.excludedByRepeat > 0 ? \` · \${pick.excludedByRepeat} excluded for variety\` : ''}
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
                  const alarmTime = await getSetting('alarm_time');
                  if (alarmTime) {
                    const [hh, mm] = alarmTime.split(':').map((s) => parseInt(s, 10));
                    const d = new Date();
                    d.setHours(hh, mm, 0, 0);
                    setAlarmDate(d);
                  }
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
                    scheduleAlarm(snoozeFor, pick.task.id, pick.task.text).catch(e => console.error(e));
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
                  alarmTime={alarmDate}
                  selectedSound={selectedSound}
                  bedtime={bedtime}
                  bedtimeEnabled={bedtimeEnabled}
                  subscriptionTier={subscriptionTier}
                  onChangeTheme={onSaveThemePreference}
                  onChangeSound={onSaveSound}
                  onChangeBedtime={onSaveBedtime}
                  onChangeTime={(date) => {
                    setAlarmDate(date);
                    setShowTimePicker(false);
                  }}
                  onResetAllData={onResetAllData}
                  onUpgrade={() => navigationRef.isReady() && navigationRef.navigate('Premium')}
                  onBack={() => navigationRef.isReady() && navigationRef.goBack()}
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
`;

code = code.substring(0, renderStart) + newRender + code.substring(renderEnd);

fs.writeFileSync('App.tsx', code);
