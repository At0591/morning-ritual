// Where the user is, for sunrise times. Approximate only (about 3 km),
// asked once, rounded to about 1 km and kept on the phone. Never sent anywhere.
import * as Location from 'expo-location';
import { getSetting, setSetting } from '../db/database';
import { roundCoordinate } from './dawnTimes';

export interface DawnPlace {
  latitude: number;
  longitude: number;
  label: string;
}

export const DAWN_PLACE_KEY = 'dawn_place';

/** Cities offered when the user would rather not share location. */
export const DAWN_CITIES: DawnPlace[] = [
  { label: 'New York', latitude: 40.71, longitude: -74.01 },
  { label: 'Chicago', latitude: 41.88, longitude: -87.63 },
  { label: 'Houston', latitude: 29.76, longitude: -95.37 },
  { label: 'Los Angeles', latitude: 34.05, longitude: -118.24 },
  { label: 'San Francisco', latitude: 37.77, longitude: -122.42 },
  { label: 'Seattle', latitude: 47.61, longitude: -122.33 },
  { label: 'Toronto', latitude: 43.65, longitude: -79.38 },
  { label: 'Vancouver', latitude: 49.28, longitude: -123.12 },
  { label: 'Montreal', latitude: 45.5, longitude: -73.57 },
  { label: 'London', latitude: 51.51, longitude: -0.13 },
  { label: 'Manchester', latitude: 53.48, longitude: -2.24 },
  { label: 'Edinburgh', latitude: 55.95, longitude: -3.19 },
  { label: 'Dublin', latitude: 53.35, longitude: -6.26 },
  { label: 'Paris', latitude: 48.86, longitude: 2.35 },
  { label: 'Berlin', latitude: 52.52, longitude: 13.4 },
  { label: 'Amsterdam', latitude: 52.37, longitude: 4.9 },
  { label: 'Madrid', latitude: 40.42, longitude: -3.7 },
  { label: 'Stockholm', latitude: 59.33, longitude: 18.07 },
  { label: 'Sydney', latitude: -33.87, longitude: 151.21 },
  { label: 'Melbourne', latitude: -37.81, longitude: 144.96 },
  { label: 'Auckland', latitude: -36.85, longitude: 174.76 },
  { label: 'Mumbai', latitude: 19.08, longitude: 72.88 },
  { label: 'Delhi', latitude: 28.61, longitude: 77.21 },
];

export async function getDawnPlace(): Promise<DawnPlace | null> {
  try {
    const raw = await getSetting(DAWN_PLACE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as DawnPlace;
    return Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? p : null;
  } catch {
    return null;
  }
}

export async function saveDawnPlace(place: DawnPlace): Promise<DawnPlace> {
  const rounded = {
    label: place.label,
    latitude: roundCoordinate(place.latitude),
    longitude: roundCoordinate(place.longitude),
  };
  await setSetting(DAWN_PLACE_KEY, JSON.stringify(rounded));
  return rounded;
}

/**
 * Ask for approximate location once and save it. Returns null if the user says
 * no or the phone can't get a fix; the caller then offers the city list.
 */
export async function locateApproximately(): Promise<DawnPlace | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    return saveDawnPlace({ label: 'Your area', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  } catch {
    return null;
  }
}
