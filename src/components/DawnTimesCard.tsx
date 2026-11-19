// Home card: today's sunrise and Brahma Muhurta, shown as information.
// Each time has a shortcut that opens the alarm editor with that time filled in;
// the user can change it to anything they like.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { DAWN_CITIES, getDawnPlace, locateApproximately, saveDawnPlace, type DawnPlace } from '../services/dawnPlace';
import { todaysDawnTimes, toAlarmTime } from '../services/dawnTimes';

type Props = {
  /** Open the alarm editor pre-filled with "HH:MM". */
  onSetAlarm: (time: string) => void;
};

const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function DawnTimesCard({ onSetAlarm }: Props) {
  const [place, setPlace] = useState<DawnPlace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [choosingCity, setChoosingCity] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  useEffect(() => {
    void getDawnPlace().then((p) => {
      setPlace(p);
      setLoaded(true);
    });
  }, []);

  const times = useMemo(() => (place ? todaysDawnTimes(place.latitude, place.longitude) : null), [place]);

  const useLocation = useCallback(async () => {
    setLocating(true);
    setLocateFailed(false);
    const p = await locateApproximately();
    setLocating(false);
    if (p) {
      setPlace(p);
      setChoosingCity(false);
    } else {
      setLocateFailed(true);
      setChoosingCity(true);
    }
  }, []);

  const chooseCity = useCallback(async (city: DawnPlace) => {
    setPlace(await saveDawnPlace(city));
    setChoosingCity(false);
  }, []);

  if (!loaded) return null;

  if (!place || choosingCity) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>SUNRISE TODAY</Text>
        <Text style={styles.body}>
          See today's sunrise and Brahma Muhurta where you are. Your location stays on your phone and is never sent
          anywhere.
        </Text>
        {locateFailed ? <Text style={styles.note}>Couldn't get your location. Pick the nearest city instead.</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => void useLocation()} accessibilityRole="button">
            <Text style={styles.primaryText}>{locating ? 'Finding you…' : 'Use my location'}</Text>
          </TouchableOpacity>
          {!choosingCity ? (
            <TouchableOpacity style={[styles.secondary, styles.flex]} onPress={() => setChoosingCity(true)} accessibilityRole="button">
              <Text style={styles.secondaryText}>Pick a city</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {choosingCity ? (
          <View style={styles.cities}>
            {DAWN_CITIES.map((c) => (
              <TouchableOpacity key={c.label} style={styles.cityChip} onPress={() => void chooseCity(c)} accessibilityRole="button">
                <Text style={styles.cityText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>SUNRISE TODAY · {place.label.toUpperCase()}</Text>

      {times?.sunrise ? (
        <View style={styles.block}>
          <Text style={styles.name}>Sunrise</Text>
          <Text style={styles.time}>{clock(times.sunrise)}</Text>
          <TouchableOpacity onPress={() => onSetAlarm(toAlarmTime(times.sunrise!))} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>Set an alarm for this time</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.body}>The sun doesn't rise here today.</Text>
      )}

      {times?.brahmaStart && times.brahmaEnd ? (
        <View style={[styles.block, styles.divided]}>
          <Text style={styles.name}>Brahma Muhurta</Text>
          <Text style={styles.time}>
            {clock(times.brahmaStart)} to {clock(times.brahmaEnd)}
          </Text>
          <Text style={styles.note}>
            A traditional time for quiet practice before dawn, from Hindu Ayurvedic texts. Worked out the way Drik Panchang
            does: one fifteenth of the night, ending one such part before sunrise.
          </Text>
          {times.bedtimeFor7h ? (
            <Text style={styles.note}>For 7 hours' sleep before it, you'd go to bed by {clock(times.bedtimeFor7h)}.</Text>
          ) : null}
          <TouchableOpacity onPress={() => onSetAlarm(toAlarmTime(times.brahmaStart!))} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>Set an alarm for this time</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity onPress={() => setChoosingCity(true)} accessibilityRole="button" style={styles.link}>
        <Text style={styles.changeText}>Change place</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  label: { ...typography.micro, color: colors.sand },
  body: { ...typography.body, color: colors.ink, marginTop: spacing.xs },
  note: { ...typography.caption, color: colors.sand, marginTop: spacing.xs, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primary: { backgroundColor: colors.sunrise, borderRadius: radius.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...typography.bodyBold, color: '#fff' },
  secondary: { borderWidth: 1.5, borderColor: colors.divider, borderRadius: radius.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...typography.bodyBold, color: colors.ink },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  cityChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 36, justifyContent: 'center' },
  cityText: { ...typography.body, color: colors.ink },
  block: { marginTop: spacing.md },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  name: { ...typography.caption, color: colors.sand },
  time: { ...typography.title, color: colors.ink, marginTop: 2 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.bodyBold, color: colors.warning },
  changeText: { ...typography.caption, color: colors.sand, textDecorationLine: 'underline' },
});
