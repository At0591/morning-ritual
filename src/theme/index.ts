// src/theme/index.ts
// Design tokens: brand "First Light" (decided 18 Nov 2026).
// Night and Dusk carry the morning (dark until you're awake); Horizon amber is
// the one accent; Linen is the daytime base. Fraunces for big moments,
// Atkinson Hyperlegible for everything people read and tap.
// Every text/background pair here was checked at 4.5:1 contrast or better;
// re-check any new pair before using it.

export const brand = {
  night: '#0E1230', // morning base
  dusk: '#1F2A55', // cards and surfaces at dawn
  amber: '#FFB454', // the one accent; text on it is ink
  ember: '#E8743B', // glow only, never behind text
  linen: '#F7F1E8', // daytime base
  ink: '#1C1A17', // daytime text
  mist: '#9AA3C7', // secondary text on dark
  stone: '#6E6458', // secondary text on light
  line: '#E8E0D3', // dividers on light
  white: '#FFFFFF',
};

// Older token names kept so existing screens restyle without rewrites.
export const colors = {
  sunrise: brand.dusk, // primary buttons and links on light screens (white text on it is 13:1)
  sunriseDark: brand.night, // pressed state
  cream: brand.linen, // background
  card: brand.white, // surface
  ink: brand.ink, // primary text
  sand: brand.stone, // secondary text
  divider: brand.line, // subtle borders
  // Semantic
  success: '#2E6B33',
  warning: '#9C4A0C', // warning text on light tints, and white text on it (both above 4.5:1)
  error: '#B3261E',
  // Category accents (icons and dots, not text)
  body: '#E8743B',
  mind: '#7C5CBF',
  brain: '#2F6FD0',
  creative: '#C99A2E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  read: 'AtkinsonHyperlegible_400Regular',
  readBold: 'AtkinsonHyperlegible_700Bold',
};

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.read, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.readBold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.read, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.readBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
};

export const shadows = {
  sm: {
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const themeColor = (theme: string): string => {
  switch (theme) {
    case 'body': return colors.body;
    case 'mind': return colors.mind;
    case 'brain': return colors.brain;
    case 'creative': return colors.creative;
    default: return brand.amber;
  }
};

export const themeEmoji = (theme: string): string => {
  switch (theme) {
    case 'body': return '🧘';
    case 'mind': return '🧠';
    case 'brain': return '💡';
    case 'creative': return '🎨';
    default: return '🌅';
  }
};
