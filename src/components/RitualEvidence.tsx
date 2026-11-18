// Shows how strong the evidence is for a ritual and where it comes from, plus
// any safety line. Sources open in the browser. Never claims more than the
// label: strong = review or guideline, moderate = trial, early = small study
// or association only.
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { sourcesFor, type Evidence, type Task } from '../db/database';
import { brand, colors, fonts } from '../theme';

const EVIDENCE_TEXT: Record<Evidence, { label: string; meaning: string }> = {
  strong: { label: 'Strong evidence', meaning: 'Backed by a review of many studies or an official guideline.' },
  moderate: { label: 'Moderate evidence', meaning: 'Backed by at least one controlled trial.' },
  early: { label: 'Early evidence', meaning: 'From a small study, or one that shows a link, not cause and effect.' },
};

export function evidenceLabel(evidence: Evidence | null): string | null {
  return evidence ? EVIDENCE_TEXT[evidence].label : null;
}

interface Props {
  task: Pick<Task, 'evidence' | 'sourceKeys' | 'safety'>;
}

export function RitualEvidence({ task }: Props) {
  const sources = sourcesFor(task.sourceKeys);
  const evidence = task.evidence ? EVIDENCE_TEXT[task.evidence] : null;
  if (!evidence && sources.length === 0 && !task.safety) return null;

  return (
    <View style={styles.wrap}>
      {task.safety ? <Text style={styles.safety}>{task.safety}</Text> : null}
      {evidence ? (
        <View style={styles.badge} accessible accessibilityLabel={`${evidence.label}. ${evidence.meaning}`}>
          <Text style={styles.badgeText}>{evidence.label}</Text>
        </View>
      ) : null}
      {sources.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => Linking.openURL(s.url).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`Source: ${s.citation}`}
          hitSlop={8}
        >
          <Text style={styles.source}>Source: {s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 6, alignItems: 'flex-start' },
  safety: { fontFamily: fonts.readBold, fontSize: 14, color: colors.warning },
  badge: { backgroundColor: brand.ink, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.readBold, fontSize: 12, color: brand.linen },
  source: { fontFamily: fonts.read, fontSize: 14, color: brand.stone, textDecorationLine: 'underline' },
});
