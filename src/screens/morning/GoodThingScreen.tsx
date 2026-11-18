// Step 3: one small good thing. Type a line or tap a suggestion; saving it
// stops the alarm and goes into the journal. Stays dark: the alarm is still on.
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanJournalText, JOURNAL_MAX_LENGTH } from '../../db/database';
import { brand, fonts } from '../../theme';
import { suggestionsFor } from '../../services/morningFlow';

interface Props {
  onSave: (line: string) => void;
}

export function GoodThingScreen({ onSave }: Props) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const suggestions = suggestionsFor(new Date());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);

  const save = () => {
    const line = cleanJournalText(text);
    if (!line) {
      setHint(true);
      return;
    }
    onSave(line);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>You're awake. One last thing.</Text>
        <Text style={styles.title}>What's one small good thing about today?</Text>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (hint) setHint(false);
          }}
          placeholder={hint ? 'Just a few words, or tap a suggestion' : 'Write a few words…'}
          placeholderTextColor={brand.mist}
          style={styles.input}
          multiline
          maxLength={JOURNAL_MAX_LENGTH}
          accessibilityLabel="Your line for today"
        />
        {suggestions.map((s) => (
          <Pressable key={s} onPress={() => setText(s)} style={styles.chip} accessibilityRole="button" accessibilityHint="Fills in this line">
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
        <View style={styles.spacer} />
        <Pressable onPress={save} style={styles.save} accessibilityRole="button">
          <Text style={styles.saveText}>Save and stop alarm</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.night },
  container: { flex: 1, backgroundColor: brand.dusk },
  content: { flexGrow: 1, paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 },
  kicker: { fontFamily: fonts.read, fontSize: 15, color: brand.mist },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: brand.white, marginTop: 6 },
  input: {
    marginTop: 20, marginBottom: 12, minHeight: 100, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: 'rgba(154,163,199,0.5)', backgroundColor: 'rgba(255,255,255,0.07)',
    color: brand.white, fontFamily: fonts.read, fontSize: 18, textAlignVertical: 'top',
  },
  chip: {
    borderWidth: 1, borderColor: 'rgba(154,163,199,0.55)', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 8, minHeight: 48, justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.read, fontSize: 16, color: brand.white },
  spacer: { flex: 1, minHeight: 24 },
  save: { backgroundColor: brand.amber, borderRadius: 18, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.readBold, fontSize: 18, color: brand.ink },
});
