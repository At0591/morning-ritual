// src/screens/PremiumScreen.tsx
// "Go Premium" screen — explains benefits, shows prices, handles purchase flow.
// Shown when user taps "Upgrade to Premium" in Settings, or when they try to
// access a premium feature.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  getOfferings,
  getSubscriptionStatus,
  initSubscriptionService,
  isIapAvailable,
  purchaseSubscription,
  restorePurchases,
  type Offerings,
  type SubscriptionTier,
} from '../services/subscription';
import { trackPremiumPromptShown, trackPremiumSubscribed } from '../services/analytics';
import { colors, radius, spacing, typography, shadows } from '../theme';

const PREMIUM_BENEFITS = [
  {
    emoji: '🎯',
    title: 'All 1,000 morning rituals',
    body: 'Get the full library across all 4 themes: body, mind, brain, creative. The free tier offers 30 per theme.',
  },
  {
    emoji: '📸',
    title: 'Unlimited photo proof',
    body: 'Capture proof of every ritual — no daily limits.',
  },
  {
    emoji: '🌙',
    title: 'Bedtime reminders',
    body: 'A 30-minute wind-down notification so you actually go to sleep, not just wake up.',
  },
  {
    emoji: '📊',
    title: 'Streak insights',
    body: 'Habit chains, longest streaks, and weekly summaries to keep you motivated.',
  },
  {
    emoji: '💎',
    title: 'Support an indie maker',
    body: "You're funding an independent developer building tools for intentional living.",
  },
];

type Props = {
  onClose: () => void;
  onPurchased?: () => void;
};

export function PremiumScreen({ onClose, onPurchased }: Props) {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<'monthly' | 'yearly' | null>(null);
  const [offerings, setOfferings] = useState<Offerings>({ monthly: null, yearly: null });
  const [iapAvailable, setIapAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const available = isIapAvailable();
      setIapAvailable(available);
      await initSubscriptionService();
      const status = await getSubscriptionStatus();
      setTier(status.tier);
      if (available) {
        const offs = await getOfferings();
        setOfferings(offs);
      }
      trackPremiumPromptShown({ source: 'Settings' }); // TODO: Pass source if dynamic
      setLoading(false);
    })();
  }, []);

  const handlePurchase = async (period: 'monthly' | 'yearly') => {
    setPurchasing(period);
    try {
      const result = await purchaseSubscription(period);
      if (result.success) {
        setTier('premium');
        trackPremiumSubscribed({ tier: period });
        Alert.alert(
          'Welcome to Premium! 🌅',
          'You now have access to all 1,000 morning rituals.',
          [{ text: 'OK', onPress: () => onPurchased?.() }]
        );
      } else if (result.error === 'cancelled') {
        // User cancelled — no alert
      } else {
        Alert.alert('Purchase failed', result.error ?? 'Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const result = await restorePurchases();
    setLoading(false);
    if (result.restored) {
      setTier(result.status.tier);
      Alert.alert('Restored!', 'Your premium subscription is back.');
    } else {
      Alert.alert('Nothing to restore', "We couldn't find an active subscription on this account.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.sunrise} />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.cream, '#FFEDDF']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color={colors.sand} />
        </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🌅</Text>
        <Text style={styles.heroTitle}>Start your day{'\n'}with intention.</Text>
        <Text style={styles.heroSubtitle}>
          {tier === 'premium'
            ? 'You have Premium — thank you for the support!'
            : 'Unlock the full ritual library.'}
        </Text>
      </View>

      {tier === 'free' ? (
        <>
          <View style={styles.benefits}>
            {PREMIUM_BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <Text style={styles.benefitEmoji}>{b.emoji}</Text>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitBody}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {!iapAvailable ? (
            <View style={styles.priceCard}>
              <Text style={styles.comingSoonBadge}>COMING IN v1.0.1</Text>
              <Text style={styles.priceCardTitle}>Premium is on the way</Text>
              <Text style={styles.comingSoonBody}>
                We're finishing the subscription system. The free tier gives you 30
                rituals per theme — plenty to start your morning with intention.
                {'\n\n'}
                Premium ($3.99/mo or $29.99/yr, price held forever) will unlock all
                1,000 rituals plus bedtime reminders.
                Watch for the update.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.priceCard}>
                <Text style={styles.priceCardTitle}>Choose your plan</Text>

                <TouchableOpacity
                  style={[styles.priceOption, styles.priceOptionPrimary]}
                  onPress={() => handlePurchase('yearly')}
                  disabled={purchasing !== null}
                  activeOpacity={0.85}
                >
                  <View style={styles.priceOptionLeft}>
                    <Text style={[styles.priceOptionTitle, styles.priceOptionTitleOnPrimary]}>
                      Yearly
                    </Text>
                    <Text style={[styles.priceOptionSubtitle, styles.priceOptionSubtitleOnPrimary]}>
                      Save 37% · ${(29.99 / 12).toFixed(2)}/mo
                    </Text>
                  </View>
                  <View style={styles.priceOptionRight}>
                    <Text style={[styles.priceOptionPrice, styles.priceOptionPriceOnPrimary]}>
                      {offerings.yearly?.priceString ?? '$29.99'}
                    </Text>
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  </View>
                  {purchasing === 'yearly' && (
                    <ActivityIndicator color={colors.cream} style={styles.purchasingSpinner} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.priceOption}
                  onPress={() => handlePurchase('monthly')}
                  disabled={purchasing !== null}
                  activeOpacity={0.85}
                >
                  <View style={styles.priceOptionLeft}>
                    <Text style={styles.priceOptionTitle}>Monthly</Text>
                    <Text style={styles.priceOptionSubtitle}>Cancel anytime</Text>
                  </View>
                  <View style={styles.priceOptionRight}>
                    <Text style={styles.priceOptionPrice}>
                      {offerings.monthly?.priceString ?? '$3.99'}
                    </Text>
                    <Text style={styles.priceOptionPer}>/ month</Text>
                  </View>
                  {purchasing === 'monthly' && (
                    <ActivityIndicator color={colors.sunrise} style={styles.purchasingSpinner} />
                  )}
                </TouchableOpacity>

                <Text style={styles.legalNote}>
                  Subscriptions auto-renew unless cancelled at least 24h before the end
                  of the current period. Manage in your App Store / Play Store settings.
                </Text>
              </View>

              <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
                <Text style={styles.restoreText}>Restore previous purchase</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        <View style={styles.alreadyPremium}>
          <Text style={styles.alreadyEmoji}>✓</Text>
          <Text style={styles.alreadyText}>You're a Premium member.</Text>
          <Text style={styles.alreadySubtext}>
            Thanks for supporting Morning Ritual. All 1,000 rituals are unlocked.
          </Text>
        </View>
      )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  closeButton: { alignSelf: 'flex-start', padding: spacing.sm, marginBottom: spacing.md },
  closeText: { ...typography.body, color: colors.sand },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroEmoji: { fontSize: 64, marginBottom: spacing.sm },
  heroTitle: { ...typography.title, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '700' },
  heroSubtitle: { ...typography.body, color: colors.sand, textAlign: 'center' },
  benefits: { marginBottom: spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  benefitEmoji: { fontSize: 24, marginRight: spacing.md, marginTop: 2 },
  benefitText: { flex: 1 },
  benefitTitle: { ...typography.body, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  benefitBody: { ...typography.caption, color: colors.sand, lineHeight: 18 },
  priceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    ...shadows.lg,
  },
  priceCardTitle: { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
  comingSoonBadge: {
    ...typography.micro,
    fontWeight: '700',
    color: colors.cream,
    backgroundColor: colors.sunrise,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  comingSoonBody: {
    ...typography.body,
    color: colors.ink,
    lineHeight: 22,
  },
  priceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
  },
  priceOptionPrimary: {
    backgroundColor: colors.sunrise,
    borderColor: colors.sunrise,
  },
  priceOptionLeft: { flex: 1 },
  priceOptionTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  priceOptionTitleOnPrimary: { color: colors.cream },
  priceOptionSubtitle: { ...typography.caption, color: colors.sand, marginTop: 2 },
  priceOptionSubtitleOnPrimary: { color: 'rgba(250, 247, 242, 0.85)' },
  priceOptionRight: { alignItems: 'flex-end' },
  priceOptionPrice: { ...typography.heading, color: colors.ink, fontWeight: '700' },
  priceOptionPriceOnPrimary: { color: colors.cream },
  priceOptionPer: { ...typography.caption, color: colors.sand },
  bestValueBadge: {
    backgroundColor: 'rgba(45, 42, 38, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  bestValueText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.cream,
  },
  purchasingSpinner: { position: 'absolute', right: spacing.md },
  legalNote: { ...typography.caption, color: colors.sand, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  restoreButton: { alignItems: 'center', padding: spacing.md },
  restoreText: { ...typography.body, color: colors.sunrise, fontWeight: '600' },
  alreadyPremium: { alignItems: 'center', padding: spacing.xl },
  alreadyEmoji: { fontSize: 64, color: colors.success, marginBottom: spacing.md },
  alreadyText: { ...typography.heading, color: colors.ink, marginBottom: spacing.sm },
  alreadySubtext: { ...typography.body, color: colors.sand, textAlign: 'center' },
});
