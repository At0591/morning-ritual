// src/screens/VerificationScreen.tsx
// Where the user proves they did the task. Three branches:
//   1. checkin  → text input
//   2. media+photo → camera capture (Phase 2.1 — LIVE)
//   3. media+audio → voice record (Phase 2.1 — LIVE)

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { useEffect } from 'react';
import { trackVerificationStart } from '../services/analytics';
import { colors, spacing, radius, typography, themeColor, themeEmoji } from '../theme';
import type { Task } from '../db/database';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CameraCapture } from '../components/CameraCapture';

interface Props {
  task: Task;
  onComplete: (verificationData: { kind: string; [key: string]: unknown }) => void;
  onCancel: () => void;
}

export function VerificationScreen({ task, onComplete, onCancel }: Props) {
  const [text, setText] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackVerificationStart({ taskTheme: task.theme, verificationMode: task.verification });
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => backHandler.remove();
  }, [onCancel]);

  if (task.verification === 'checkin') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{themeEmoji(task.theme)} Verification</Text>
          <Text style={styles.title}>How did it go?</Text>
          <Text style={styles.taskText}>"{task.text}"</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="A few words is enough…"
          placeholderTextColor={colors.sand}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={4}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.cta, text.trim().length === 0 && styles.ctaDisabled]}
          onPress={async () => {
            if (text.trim().length === 0) return;
            setSubmitting(true);
            onComplete({ kind: 'checkin', text: text.trim() });
          }}
          disabled={submitting || text.trim().length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{submitting ? 'Marking complete…' : 'Mark complete'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Audio verification — LIVE
  if (task.mediaType === 'audio') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{themeEmoji(task.theme)} Verification</Text>
          <Text style={styles.title}>Record your voice memo</Text>
          <Text style={styles.taskText}>"{task.text}"</Text>
        </View>

        <VoiceRecorder
          onRecorded={(uri, durationMs) => {
            setAudioUri(uri);
            setAudioDurationMs(durationMs);
          }}
        />

        <TouchableOpacity
          style={[styles.cta, !audioUri && styles.ctaDisabled]}
          onPress={() => {
            if (!audioUri) return;
            onComplete({
              kind: 'audio',
              uri: audioUri,
              durationMs: audioDurationMs,
            });
          }}
          disabled={!audioUri}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Mark complete</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Photo verification — LIVE
  if (task.mediaType === 'photo') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{themeEmoji(task.theme)} Verification</Text>
          <Text style={styles.title}>Snap your proof</Text>
          <Text style={styles.taskText}>"{task.text}"</Text>
        </View>

        <CameraCapture
          onCaptured={(uri) => setPhotoUri(uri)}
        />

        <TouchableOpacity
          style={[styles.cta, !photoUri && styles.ctaDisabled]}
          onPress={() => {
            if (!photoUri) return;
            onComplete({ kind: 'photo', uri: photoUri });
          }}
          disabled={!photoUri}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Mark complete</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Video — still placeholder
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{themeEmoji(task.theme)} Verification</Text>
        <Text style={styles.title}>Capture your proof</Text>
        <Text style={styles.taskText}>"{task.text}"</Text>
      </View>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderEmoji}>🎥</Text>
        <Text style={styles.placeholderTitle}>Video capture</Text>
        <Text style={styles.placeholderSub}>
          Video recording is coming next. For now, tap below to mark complete.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={() =>
          onComplete({ kind: task.mediaType ?? 'media', simulated: true })
        }
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Mark complete (simulated)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancel} onPress={onCancel}>
        <Text style={styles.cancelText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.sand,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  taskText: {
    ...typography.body,
    color: colors.sand,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  placeholderCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  placeholderTitle: {
    ...typography.heading,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  placeholderSub: {
    ...typography.caption,
    color: colors.sand,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaDisabled: {
    backgroundColor: colors.divider,
  },
  ctaText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  cancel: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...typography.caption,
    color: colors.sand,
  },
});
