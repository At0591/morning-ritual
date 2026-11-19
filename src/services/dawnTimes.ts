// Today's sunrise and Brahma Muhurta for a place, worked out on the phone.
//
// Sunrise comes from SunCalc (Meeus formulas, offline). Brahma Muhurta is the
// 14th of the 15 muhurtas of the night: it starts two muhurtas before sunrise
// and ends one muhurta before sunrise. Like Drik Panchang, a muhurta here is
// one fifteenth of the night (yesterday's sunset to today's sunrise), so the
// window is shorter in summer and longer in winter.
import SunCalc from 'suncalc';

export interface DawnTimes {
  /** null when the sun doesn't rise that day (far north in winter, or no sunset in summer). */
  sunrise: Date | null;
  brahmaStart: Date | null;
  brahmaEnd: Date | null;
  /** Bedtime that still gives 7 hours of sleep before Brahma Muhurta starts. */
  bedtimeFor7h: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000;

function valid(d: Date | undefined): d is Date {
  return !!d && !Number.isNaN(d.getTime());
}

/**
 * Times for the day that contains `day` at the given place. Pass a moment around
 * local midday so SunCalc picks the right date.
 */
export function dawnTimesFor(day: Date, latitude: number, longitude: number): DawnTimes {
  const today = SunCalc.getTimes(day, latitude, longitude);
  const yesterday = SunCalc.getTimes(new Date(day.getTime() - DAY_MS), latitude, longitude);
  const sunrise = valid(today.sunrise) ? today.sunrise : null;
  const lastSunset = valid(yesterday.sunset) ? yesterday.sunset : null;

  if (!sunrise || !lastSunset || lastSunset >= sunrise) {
    return { sunrise, brahmaStart: null, brahmaEnd: null, bedtimeFor7h: null };
  }
  const muhurta = (sunrise.getTime() - lastSunset.getTime()) / 15;
  const brahmaStart = new Date(sunrise.getTime() - 2 * muhurta);
  const brahmaEnd = new Date(sunrise.getTime() - muhurta);
  return {
    sunrise,
    brahmaStart,
    brahmaEnd,
    bedtimeFor7h: new Date(brahmaStart.getTime() - SEVEN_HOURS_MS),
  };
}

/** Today's times at the user's place, using local midday. */
export function todaysDawnTimes(latitude: number, longitude: number, now = new Date()): DawnTimes {
  const midday = new Date(now);
  midday.setHours(12, 0, 0, 0);
  return dawnTimesFor(midday, latitude, longitude);
}

/** "HH:MM" in local time, for pre-filling the alarm editor. */
export function toAlarmTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Round to about 1 km so we never keep a precise position. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
