// src/theme/index.ts
// Design tokens for Morning Ritual.
// Color palette: warm sunrise (orange) + cream + deep brown.
// Typography: system font (Expo default), with weight variations for hierarchy.

export const colors = {
  // Primary palette
  sunrise: '#FF6B35',      // primary brand color
  sunriseDark: '#E55A2B',  // pressed state
  cream: '#FAF7F2',        // background
  card: '#FFFFFF',         // surface
  ink: '#2D2A26',          // primary text
  sand: '#8A8175',         // secondary text
  divider: '#EFE9E0',      // subtle borders
  // Semantic
  success: '#2E7D32',      // green for completion
  warning: '#E65100',      // orange for warnings
  error: '#C62828',        // red for errors
  // Theme accents (used for the 4 categories)
  body: '#FF8A65',         // warm orange
  mind: '#AB47BC',         // purple
  brain: '#42A5F5',        // blue
  creative: '#FFCA28',     // yellow
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

export const typography = {
  display: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  heading: { fontFamily: 'Outfit_600SemiBold', fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontFamily: 'Inter_600SemiBold', fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  micro: { fontFamily: 'Inter_500Medium', fontSize: 11, fontWeight: '500' as const, lineHeight: 14, letterSpacing: 0.5 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
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
    default: return colors.sunrise;
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
