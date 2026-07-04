// src/screens/HistoryScreen.tsx
// Past 30 days of completions. Each entry shows:
//   - Date / time
//   - Task text
//   - Theme emoji
//   - Verification type (✓ check-in, 📷 photo, 🎙️ audio)
//   - Outcome (completed, skipped, snoozed, missed)
// For media proofs: thumbnail (photo) or play button (audio)

import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors, radius, spacing, typography, themeColor, themeEmoji } from '../theme';
import { getHistory, HistoryEntry } from '../db/database';

interface Props {
  onBack: () => void;
}

export function HistoryScreen({ onBack }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const h = await getHistory(100);
        setEntries(h);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        try { sound.unloadAsync(); } catch {}
      }
    };
  }, [sound]);

  const playAudio = async (uri: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      if (playingUri === uri) {
        setPlayingUri(null);
        return;
      }
      const { sound: s } = await Audio.Sound.createAsync({ uri });
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingUri(null);
        }
      });
      await s.playAsync();
      setSound(s);
      setPlayingUri(uri);
    } catch {}
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.subheader}>
        <Text style={styles.subheaderText}>
          {entries.filter((e) => e.outcome === 'completed').length} completed · {entries.length} total
        </Text>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>No completions yet</Text>
          <Text style={styles.emptySub}>
            Once you complete tasks, they'll show up here with their proofs.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{formatDate(entry.firedAt)}</Text>
                <View
                  style={[
                    styles.outcomeBadge,
                    entry.outcome === 'completed' && styles.outcomeCompleted,
                    entry.outcome === 'skipped' && styles.outcomeSkipped,
                  ]}
                >
                  <Text style={styles.outcomeText}>{entry.outcome}</Text>
                </View>
              </View>

              {entry.task ? (
                <>
                  <View style={styles.taskRow}>
                    <Text style={styles.taskEmoji}>{themeEmoji(entry.task.theme)}</Text>
                    <Text style={styles.taskText} numberOfLines={3}>
                      {entry.task.text}
                    </Text>
                  </View>

                  {/* Proof preview */}
                  {entry.verificationData?.kind === 'photo' && entry.verificationData.uri ? (
                    <Image
                      source={{ uri: entry.verificationData.uri }}
                      style={styles.proofImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  {entry.verificationData?.kind === 'audio' && entry.verificationData.uri ? (
                    <TouchableOpacity
                      style={styles.audioRow}
                      onPress={() => playAudio(entry.verificationData.uri)}
                    >
                      <Text style={styles.audioIcon}>
                        {playingUri === entry.verificationData.uri ? '⏸' : '▶'}
                      </Text>
                      <Text style={styles.audioText}>
                        {playingUri === entry.verificationData.uri ? 'Playing…' : 'Play voice memo'}
                      </Text>
                      {entry.verificationData.durationMs ? (
                        <Text style={styles.audioDuration}>
                          {Math.round(entry.verificationData.durationMs / 1000)}s
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                  {entry.verificationData?.kind === 'checkin' && entry.verificationData.text ? (
                    <View style={styles.checkinRow}>
                      <Text style={styles.checkinLabel}>✓ Note</Text>
                      <Text style={styles.checkinText}>{entry.verificationData.text}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.missingTask}>(task removed from library)</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  subheader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  subheaderText: {
    ...typography.caption,
    color: colors.sand,
  },
  empty: {
    textAlign: 'center',
    color: colors.sand,
    marginTop: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptySub: {
    ...typography.caption,
    color: colors.sand,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  entry: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  entryDate: {
    ...typography.caption,
    color: colors.sand,
  },
  outcomeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.divider,
  },
  outcomeCompleted: {
    backgroundColor: '#E8F5E9',
  },
  outcomeSkipped: {
    backgroundColor: '#FFF3E0',
  },
  outcomeText: {
    ...typography.micro,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  taskEmoji: {
    fontSize: 18,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  taskText: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 22,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: '#000',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  audioIcon: {
    fontSize: 20,
    color: colors.sunrise,
    marginRight: spacing.sm,
  },
  audioText: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  audioDuration: {
    ...typography.caption,
    color: colors.sand,
  },
  checkinRow: {
    backgroundColor: colors.cream,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  checkinLabel: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.xs,
  },
  checkinText: {
    ...typography.body,
    color: colors.ink,
    fontStyle: 'italic',
  },
  missingTask: {
    ...typography.caption,
    color: colors.sand,
    fontStyle: 'italic',
  },
});
