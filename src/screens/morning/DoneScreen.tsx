// Step 4: you're up. Daylight colours from here on. Shows the saved line, the
// streak, and today's ritual as an optional extra with its evidence.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Task } from '../../db/database';
import { RitualEvidence } from '../../components/RitualEvidence';
import { brand, fonts } from '../../theme';

interface Props {
  line: string;
  streakCount: number;
  ritual: Task | null;
  checkInAt: Date | null;
  onRitualDone: () => void;
  onLater: () => void;
}

export function DoneScreen({ line, streakCount, ritual, checkInAt, onRitualDone, onLater }: Props) {
  const insets = useSafeAreaInsets();
  const weekday = new Date().toLocaleDateString([], { weekday: 'long' });
  const checkIn = checkInAt ? checkInAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
      <StatusBar style="dark" />
      <Text style={styles.muted}>{weekday}</Text>
      <Text style={styles.title}>You're up. That's the hard part done.</Text>
      {streakCount > 1 ? <Text style={styles.muted}>{streakCount} mornings in a row.</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>SAVED TO YOUR JOURNAL</Text>
        <Text style={styles.line}>"{line}"</Text>
      </View>

      {ritual ? (
        <View style={styles.card}>
          <Text style={styles.label}>TODAY'S RITUAL · OPTIONAL · ~{ritual.estSeconds}s</Text>
          <Text style={styles.ritualText}>{ritual.text}</Text>
          {ritual.whyItMatters ? <Text style={styles.why}>{ritual.whyItMatters}</Text> : null}
          <RitualEvidence task={ritual} />
          <View style={styles.row}>
            <Pressable onPress={onRitualDone} style={[styles.btn, styles.primary]} accessibilityRole="button">
              <Text style={styles.primaryText}>Done it</Text>
            </Pressable>
            <Pressable onPress={onLater} style={[styles.btn, styles.outline]} accessibilityRole="button">
              <Text style={styles.outlineText}>Later</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={onLater} style={[styles.btn, styles.primary, styles.single]} accessibilityRole="button">
          <Text style={styles.primaryText}>Start my day</Text>
        </Pressable>
      )}

      <View style={styles.spacer} />
      {checkIn ? <Text style={styles.footer}>We'll check you're still up at {checkIn}.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.linen },
  content: { flexGrow: 1, paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 },
  muted: { fontFamily: fonts.read, fontSize: 16, color: brand.stone, marginTop: 4 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: brand.ink, marginTop: 4 },
  card: {
    backgroundColor: brand.white, borderRadius: 22, padding: 18, marginTop: 16,
    shadowColor: brand.ink, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  label: { fontFamily: fonts.readBold, fontSize: 12, letterSpacing: 1, color: brand.stone },
  line: { fontFamily: fonts.read, fontSize: 18, color: brand.ink, marginTop: 6, fontStyle: 'italic' },
  ritualText: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: brand.ink, marginTop: 6 },
  why: { fontFamily: fonts.read, fontSize: 15, lineHeight: 21, color: brand.stone, marginTop: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  single: { flex: 0, marginTop: 20 },
  primary: { backgroundColor: brand.amber },
  primaryText: { fontFamily: fonts.readBold, fontSize: 17, color: brand.ink },
  outline: { borderWidth: 1.5, borderColor: brand.line },
  outlineText: { fontFamily: fonts.readBold, fontSize: 17, color: brand.ink },
  spacer: { flex: 1, minHeight: 24 },
  footer: { fontFamily: fonts.read, fontSize: 14, color: brand.stone, textAlign: 'center' },
});
