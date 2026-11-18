// Step 3: one small good thing. Type a line, or tap a prompt to start the
// sentence and finish it. Saving stops the alarm and goes into the journal.
// The prompts come from sourced rituals (see services/morningFlow).
// Stays dark: the alarm is still on.
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanJournalText, JOURNAL_MAX_LENGTH } from '../../db/database';
import { brand, fonts } from '../../theme';
import { suggestionsFor, type GoodThingPrompt } from '../../services/morningFlow';

interface Props {
  onSave: (line: string) => void;
}

export function GoodThingScreen({ onSave }: Props) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [starter, setStarter] = useState<string | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const suggestions = suggestionsFor(new Date());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);

  const usePrompt = (p: GoodThingPrompt) => {
    setText(p.starter);
    setStarter(p.starter);
    setHint(null);
    input.current?.focus();
  };

  const save = () => {
    const line = cleanJournalText(text);
    if (!line) {
      setHint('Just a few words, or tap a prompt');
      return;
    }
    if (starter && line === cleanJournalText(starter)) {
      setHint('Finish the sentence in your own words');
      input.current?.focus();
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
          ref={input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (hint) setHint(null);
          }}
          placeholder={'Write a few words…'}
          placeholderTextColor={brand.mist}
          style={styles.input}
          multiline
          maxLength={JOURNAL_MAX_LENGTH}
          accessibilityLabel="Your line for today"
        />
        {hint ? <Text style={styles.hint} accessibilityLiveRegion="polite">{hint}</Text> : null}
        {suggestions.map((p) => (
          <Pressable key={p.id} onPress={() => usePrompt(p)} style={styles.chip} accessibilityRole="button" accessibilityHint="Starts the sentence for you to finish">
            <Text style={styles.chipText}>{p.label}</Text>
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
  hint: { fontFamily: fonts.readBold, fontSize: 15, color: brand.amber, marginBottom: 4 },
  spacer: { flex: 1, minHeight: 24 },
  save: { backgroundColor: brand.amber, borderRadius: 18, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.readBold, fontSize: 18, color: brand.ink },
});
