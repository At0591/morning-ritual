// src/screens/PremiumScreen.tsx
// Premium screen: what Premium adds, prices, and the purchase flow.
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

// What Premium adds. The alarm, the morning flow and your journal stay free.
const PREMIUM_BENEFITS: Array<{ icon: keyof typeof Feather.glyphMap; title: string; body: string }> = [
  {
    icon: 'shield',
    title: 'Stricter ways to get up',
    body: 'Every strict mode: open the curtains, scan a sticker in another room, or walk a few steps. One is free.',
  },
  {
    icon: 'bell',
    title: 'A firmer "Still up?"',
    body: 'Choose when the check comes and how hard it is to dismiss, for mornings you know you will snooze.',
  },
  {
    icon: 'bar-chart-2',
    title: 'Wake-up insights',
    body: 'A weekly recap of how many mornings you were up on time.',
  },
  {
    icon: 'music',
    title: 'More gentle tunes',
    body: 'More licensed melodic tunes, and you choose how long the tune takes to rise.',
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
          'Premium is on',
          'Thanks for supporting KindRise. The strict modes and insights are now open.',
          [{ text: 'OK', onPress: () => onPurchased?.() }]
        );
      } else if (result.error === 'cancelled') {
        // The user cancelled, so no alert.
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
      Alert.alert('Premium restored', 'Your subscription is active again.');
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
        <Text style={styles.heroTitle}>KindRise Premium</Text>
        <Text style={styles.heroSubtitle}>
          {tier === 'premium'
            ? 'You have Premium. Thank you for supporting KindRise.'
            : 'Extra help for the mornings that are hardest to get up. The alarm and your journal stay free.'}
        </Text>
      </View>

      {tier === 'free' ? (
        <>
          <View style={styles.benefits}>
            {PREMIUM_BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <Feather name={b.icon} size={22} color={colors.warning} style={styles.benefitIcon} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitBody}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {!iapAvailable ? (
            <View style={styles.priceCard}>
              <Text style={styles.comingSoonBadge}>COMING LATER</Text>
              <Text style={styles.priceCardTitle}>Premium isn't available yet</Text>
              <Text style={styles.comingSoonBody}>
                Everything you need to wake up is free today: the gentle alarm, the sun tap, your journal,
                the "Still up?" check and all 41 rituals. Premium will come in a later update, and nothing
                you use now will move behind it.
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
                      ${(29.99 / 12).toFixed(2)} a month, billed yearly
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
                      {offerings.monthly?.priceString ?? '$4.99'}
                    </Text>
                    <Text style={styles.priceOptionPer}>/ month</Text>
                  </View>
                  {purchasing === 'monthly' && (
                    <ActivityIndicator color={colors.sunrise} style={styles.purchasingSpinner} />
                  )}
                </TouchableOpacity>

                <Text style={styles.legalNote}>
                  Your subscription renews automatically until you cancel. Cancel at least 24 hours before
                  the renewal date in Google Play, under Payments and subscriptions.
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
            Thanks for supporting KindRise. The strict modes, insights and extra tunes are open.
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
  heroTitle: { ...typography.title, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '700' },
  heroSubtitle: { ...typography.body, color: colors.sand, textAlign: 'center' },
  benefits: { marginBottom: spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  benefitIcon: { marginRight: spacing.md, marginTop: 2 },
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
