// src/services/sounds.ts
// Alarm sound catalog. Each option maps to a real bundled MP3 in
// assets/sounds/. All 5 nature sounds ship free to everyone (per product
// decision 2026-06-06: "keep the tunes for both free and premium,
// everyone must benefit from them").
//
// All audio sourced from Freesound.org under CC0 / public domain.
// Attribution not required, safe for commercial use.

export interface SoundOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** require() path to the bundled MP3 in assets/sounds/tunes/ */
  file: number;
  /** Source attribution (Freesound username + sound ID) */
  source: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'ocean-atlantic',
    name: 'Atlantic Ocean',
    emoji: '🌊',
    description: 'Calm rolling waves — wake to the sea',
    file: require('../../assets/sounds/tunes/ocean-atlantic.mp3'),
    source: 'Freesound · Atlantic Ocean Waves (CC0)',
  },
  {
    id: 'forest-bird',
    name: 'Forest Bird',
    emoji: '🐦',
    description: 'Single bird in a quiet forest — gentle and intimate',
    file: require('../../assets/sounds/tunes/forest-bird.mp3'),
    source: 'Freesound · forest-bird (CC0)',
  },
  {
    id: 'forest-slovenia',
    name: 'Forest Chorus',
    emoji: '🌲',
    description: 'Birdsong in a Slovenian forest — full morning chorus',
    file: require('../../assets/sounds/tunes/forest-slovenia.mp3'),
    source: 'Freesound · Birds in the Slovenian Forest (CC0)',
  },
  {
    id: 'stream-river-light',
    name: 'Gentle Stream',
    emoji: '💧',
    description: 'Light daytime stream — soft, continuous',
    file: require('../../assets/sounds/tunes/stream-river-light.mp3'),
    source: 'Freesound · River Light stream daytime (CC0)',
  },
  {
    id: 'wind-chime',
    name: 'Wind Chimes',
    emoji: '🍃',
    description: 'Gentle wind with soft chimes — light and melodic',
    file: require('../../assets/sounds/tunes/wind-chime.mp3'),
    source: 'Freesound · Wind Chime Gentle (CC0)',
  },
];

export function getSoundById(id: string | null): SoundOption {
  return SOUND_OPTIONS.find((s) => s.id === id) ?? SOUND_OPTIONS[0];
}

/** Default sound for new installs. */
export const DEFAULT_SOUND_ID = 'ocean-atlantic';
