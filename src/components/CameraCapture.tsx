// src/components/CameraCapture.tsx
// Camera capture flow: request permission → preview → capture → preview photo → confirm/retake.
// Uses expo-camera. Saves the photo URI to the app's document directory.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  onCaptured: (uri: string) => void;
}

type State = 'requesting-perm' | 'preview' | 'reviewing' | 'error';

export function CameraCapture({ onCaptured }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>('requesting-perm');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      setState('preview');
    } else if (!permission.canAskAgain) {
      setState('error');
      setErrorMsg('Camera permission permanently denied. Enable it in Settings to capture photos.');
    } else {
      // auto-request on mount
      (async () => {
        const result = await requestPermission();
        if (result.granted) {
          setState('preview');
        } else {
          setState('error');
          setErrorMsg('Camera permission denied.');
        }
      })();
    }
  }, [permission]);

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        exif: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setState('reviewing');
        onCaptured(photo.uri);
      }
    } catch (e: any) {
      setState('error');
      setErrorMsg(e?.message ?? String(e));
    }
  };

  const retake = () => {
    setPhotoUri(null);
    setState('preview');
  };

  if (state === 'requesting-perm') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.sunrise} />
        <Text style={styles.hint}>Requesting camera…</Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg ?? 'Camera unavailable'}</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={async () => {
            const result = await requestPermission();
            if (result.granted) setState('preview');
          }}
        >
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'reviewing' && photoUri) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
        <View style={styles.reviewActions}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={retake}>
            <Text style={[styles.btnText, styles.btnTextSecondary]}>↻ Retake</Text>
          </TouchableOpacity>
          <View style={styles.spacer} />
          <View style={styles.capturedBadge}>
            <Text style={styles.capturedEmoji}>📷</Text>
            <Text style={styles.capturedText}>Captured</Text>
          </View>
        </View>
      </View>
    );
  }

  // preview state
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />
      <View style={styles.cameraOverlay}>
        <View style={styles.cameraTopBar}>
          <Text style={styles.cameraHint}>Frame your shot</Text>
        </View>
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity style={styles.shutter} onPress={capture} activeOpacity={0.7}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    minHeight: 200,
    justifyContent: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.sand,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: colors.sunrise,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  btnText: {
    color: '#fff',
    ...typography.bodyBold,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  btnTextSecondary: {
    color: colors.ink,
  },
  cameraContainer: {
    height: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: spacing.lg,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cameraHint: {
    color: '#fff',
    ...typography.caption,
    textAlign: 'center',
  },
  cameraBottomBar: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  previewContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#000',
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  spacer: {
    flex: 1,
  },
  capturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  capturedEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  capturedText: {
    ...typography.bodyBold,
    color: colors.success,
  },
});
