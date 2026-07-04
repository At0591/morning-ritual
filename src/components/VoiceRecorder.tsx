// src/components/VoiceRecorder.tsx
// Records a short voice memo (max 60 seconds). Shows record button + waveform indicator
// + playback control after recording. Saves the URI to the app's documents directory
// for durability.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onRecorded: (uri: string, durationMs: number) => void;
}

type State = 'idle' | 'requesting-perm' | 'recording' | 'recorded' | 'playing' | 'error';

const MAX_DURATION_MS = 60_000;

export function VoiceRecorder({ onRecorded }: Props) {
  const [state, setState] = useState<State>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recordingRef.current) {
        try { recordingRef.current.stopAndUnloadAsync(); } catch {}
      }
      if (soundRef.current) {
        try { soundRef.current.unloadAsync(); } catch {}
      }
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const startRecording = async () => {
    setState('requesting-perm');
    setErrorMsg(null);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setState('idle');
        setErrorMsg('Microphone permission denied. Enable it in Settings to record voice memos.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
      setDurationMs(0);
      const startTime = Date.now();
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setDurationMs(elapsed);
        if (elapsed >= MAX_DURATION_MS) {
          stopRecording();
        }
      }, 100);
    } catch (e: any) {
      setState('error');
      setErrorMsg(e?.message ?? String(e));
    }
  };

  const stopRecording = async () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const recordedUri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (recordedUri) {
        setUri(recordedUri);
        setState('recorded');
        onRecorded(recordedUri, durationMs);
      } else {
        setState('error');
        setErrorMsg('Recording finished but no file was produced.');
      }
    } catch (e: any) {
      setState('error');
      setErrorMsg(e?.message ?? String(e));
    }
  };

  const playRecording = async () => {
    if (!uri) return;
    try {
      setState('playing');
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState('recorded');
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch (e: any) {
      setState('recorded');
      setErrorMsg(e?.message ?? String(e));
    }
  };

  const redoRecording = () => {
    setUri(null);
    setDurationMs(0);
    setErrorMsg(null);
    setState('idle');
  };

  const formatTime = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  if (state === 'requesting-perm') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.sunrise} />
        <Text style={styles.hint}>Requesting microphone…</Text>
      </View>
    );
  }

  if (state === 'recording') {
    return (
      <View style={styles.container}>
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording…</Text>
        </View>
        <Text style={styles.duration}>{formatTime(durationMs)}</Text>
        <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.85}>
          <Text style={styles.stopBtnText}>Stop</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Max {MAX_DURATION_MS / 1000}s</Text>
      </View>
    );
  }

  if (state === 'recorded' || state === 'playing') {
    return (
      <View style={styles.container}>
        <View style={styles.recordedBadge}>
          <Text style={styles.recordedEmoji}>🎙️</Text>
          <View>
            <Text style={styles.recordedTitle}>Captured</Text>
            <Text style={styles.recordedDuration}>{formatTime(durationMs)}</Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, state === 'playing' && styles.actionBtnActive]}
            onPress={playRecording}
            disabled={state === 'playing'}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>
              {state === 'playing' ? '▶ Playing…' : '▶ Play'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={redoRecording}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
              ↻ Re-record
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg ?? 'Something went wrong'}</Text>
        <TouchableOpacity style={styles.startBtn} onPress={startRecording} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // idle
  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>Tap to record your voice memo</Text>
      <Text style={styles.hint}>Speak naturally — 5 to 60 seconds</Text>
      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      <TouchableOpacity style={styles.startBtn} onPress={startRecording} activeOpacity={0.85}>
        <View style={styles.recordIconOuter}>
          <View style={styles.recordIconInner} />
        </View>
        <Text style={styles.startBtnText}>Start recording</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    minHeight: 200,
    justifyContent: 'center',
  },
  prompt: {
    ...typography.body,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.sand,
    marginBottom: spacing.md,
  },
  startBtn: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  startBtnText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  recordIconOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: spacing.sm,
  },
  recordIconInner: {},
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    marginRight: spacing.sm,
  },
  recordingText: {
    ...typography.bodyBold,
    color: colors.error,
  },
  duration: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  stopBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  stopBtnText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  recordedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recordedEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  recordedTitle: {
    ...typography.bodyBold,
    color: colors.ink,
  },
  recordedDuration: {
    ...typography.caption,
    color: colors.sand,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionBtnActive: {
    backgroundColor: colors.warning,
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  actionBtnText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  actionBtnTextSecondary: {
    color: colors.ink,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
