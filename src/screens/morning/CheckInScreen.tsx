// The "Still up?" follow-up, about 10 minutes after the morning flow. It rings
// quietly and rises like the main alarm; one tap stops it.
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { playAlarmSound, showOverLockScreen } from '../../services/alarm';
import { brand, fonts } from '../../theme';
import { splitClock } from '../../utils/dates';

interface Props {
  onUp: () => void;
}

export function CheckInScreen({ onUp }: Props) {
  const [now] = useState(new Date());

  useEffect(() => {
    playAlarmSound();
    showOverLockScreen(true);
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);

  const { time, suffix } = splitClock(now);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.time}>
        {time}
        {suffix ? <Text style={styles.suffix}> {suffix}</Text> : null}
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>MORNING RITUAL</Text>
        <Text style={styles.title}>Still up?</Text>
        <Text style={styles.body}>Just checking you didn't drift back off.</Text>
        <Pressable onPress={onUp} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>I'm up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.night, paddingTop: 72, paddingHorizontal: 24 },
  time: { fontFamily: fonts.display, fontSize: 72, color: brand.white, textAlign: 'center' },
  suffix: { fontFamily: fonts.read, fontSize: 20, color: brand.mist },
  card: { backgroundColor: brand.linen, borderRadius: 24, padding: 22, marginTop: 48 },
  label: { fontFamily: fonts.readBold, fontSize: 12, letterSpacing: 1, color: brand.stone },
  title: { fontFamily: fonts.display, fontSize: 28, color: brand.ink, marginTop: 6 },
  body: { fontFamily: fonts.read, fontSize: 16, color: brand.stone, marginTop: 4 },
  btn: { backgroundColor: brand.amber, borderRadius: 16, minHeight: 58, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  btnText: { fontFamily: fonts.readBold, fontSize: 18, color: brand.ink },
});
