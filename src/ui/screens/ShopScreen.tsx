import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOSTER_PRICES } from '@config/boosters';
import type { BoosterKind } from '@config/boosters';
import type { RootScreenProps } from '@navigation/types';
import { useProgress } from '@state/StoresContext';
import { Coin } from '@ui/components/Coin';
import { RoundButton } from '@ui/components/RoundButton';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, textOutline } from '@ui/theme/tokens';

const GLYPH: Readonly<Record<BoosterKind, string>> = {
  undo: '↺',
  hint: '✦',
  shuffle: '↔',
};

const NAME: Readonly<Record<BoosterKind, string>> = {
  undo: 'Undo',
  hint: 'Wand',
  shuffle: 'Shuffle',
};

/** Real-money offers. Shown for the design; no store is connected yet. */
const BUNDLES = [
  {
    id: 'super',
    name: 'Super Bundle',
    off: 40,
    coins: 1200,
    boosters: 3,
    price: '$2.99',
  },
  {
    id: 'mega',
    name: 'Mega Bundle',
    off: 50,
    coins: 3000,
    boosters: 6,
    price: '$5.99',
  },
  {
    id: 'brilliance',
    name: 'Brilliance Bundle',
    off: 50,
    coins: 6800,
    boosters: 12,
    price: '$11.99',
  },
] as const;

const PACKS = [
  { id: 'p240', coins: 240, price: '$0.49' },
  { id: 'p720', coins: 720, price: '$1.49' },
  { id: 'p1500', coins: 1500, price: '$2.49' },
] as const;

const MESSAGE_MS = 2400;

/** Order shown in the shop, as in the reference game. */
const KINDS: readonly BoosterKind[] = ['undo', 'hint', 'shuffle'];

function Stat({ children }: { children: React.ReactNode }) {
  return <View style={styles.stat}>{children}</View>;
}

export function ShopScreen({ navigation }: RootScreenProps<'Shop'>) {
  useLanguage();
  const insets = useSafeAreaInsets();
  const coins = useProgress(s => s.coins);
  const inventory = useProgress(s => s.inventory);
  const buyBooster = useProgress(s => s.buyBooster);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) {
      return undefined;
    }
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const buy = (kind: BoosterKind) => {
    setMessage(
      buyBooster(kind)
        ? t('shop.bought', { name: NAME[kind] })
        : t('shop.noCoins'),
    );
  };

  return (
    <View testID="shop" style={styles.container}>
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <View style={styles.back}>
          <RoundButton
            testID="shop-back"
            glyph="←"
            label={t('map.back')}
            onPress={() => navigation.goBack()}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('shop.title')}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat>
          <Coin size={22} />
          <Text testID="shop-coins" style={styles.statText}>
            {coins}
          </Text>
        </Stat>
        {KINDS.map(kind => (
          <Stat key={kind}>
            <Text style={styles.statGlyph}>{GLYPH[kind]}</Text>
            <Text testID={`shop-stock-${kind}`} style={styles.statText}>
              {inventory[kind] ?? 0}
            </Text>
          </Stat>
        ))}
      </View>

      {message ? (
        <Text
          testID="shop-message"
          accessibilityLiveRegion="polite"
          style={styles.message}
        >
          {message}
        </Text>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>{t('shop.boosters')}</Text>
        {KINDS.map(kind => {
          const affordable = coins >= BOOSTER_PRICES[kind];
          return (
            <View key={kind} style={styles.row}>
              <View style={styles.boosterIcon}>
                <Text style={styles.boosterGlyph}>{GLYPH[kind]}</Text>
              </View>
              <Text style={styles.rowName}>{NAME[kind]}</Text>
              <Pressable
                testID={`shop-buy-${kind}`}
                accessibilityRole="button"
                accessibilityLabel={t('shop.buy', {
                  name: NAME[kind],
                  price: BOOSTER_PRICES[kind],
                })}
                onPress={() => buy(kind)}
                style={[styles.buy, !affordable && styles.buyDim]}
              >
                <Coin size={18} />
                <Text style={styles.buyText}>{BOOSTER_PRICES[kind]}</Text>
              </Pressable>
            </View>
          );
        })}

        <Text style={styles.section}>{t('shop.bundles')}</Text>
        {BUNDLES.map(bundle => (
          <View key={bundle.id} style={styles.bundle}>
            <View style={styles.offBadge}>
              <Text style={styles.offText}>{`${bundle.off}%\nOFF`}</Text>
            </View>
            <View style={styles.bundleBody}>
              <Text style={styles.bundleName}>{bundle.name}</Text>
              <Text style={styles.bundleContents}>
                {`${bundle.coins} coins  ·  ${bundle.boosters} of each booster`}
              </Text>
            </View>
            <Pressable
              testID={`shop-bundle-${bundle.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${bundle.name} ${bundle.price}`}
              onPress={() => setMessage(t('shop.unavailable'))}
              style={styles.price}
            >
              <Text style={styles.priceText}>{bundle.price}</Text>
            </Pressable>
          </View>
        ))}

        {PACKS.map(pack => (
          <View key={pack.id} style={styles.pack}>
            <Coin size={26} />
            <Text style={styles.packCoins}>{`x${pack.coins}`}</Text>
            <Pressable
              testID={`shop-pack-${pack.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${pack.coins} coins ${pack.price}`}
              onPress={() => setMessage(t('shop.unavailable'))}
              style={styles.price}
            >
              <Text style={styles.priceText}>{pack.price}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4A94E6' },
  header: { alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  back: { position: 'absolute', left: 12, bottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', ...textOutline },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  stat: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 17,
    backgroundColor: '#2D5FAE',
  },
  statText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  statGlyph: { fontSize: 18, fontWeight: '900', color: '#FFD035' },
  message: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(20, 40, 90, 0.7)',
  },
  list: { padding: 12, gap: 10 },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    ...textOutline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#FFF7E6',
  },
  boosterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A5E50',
  },
  boosterGlyph: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  rowName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#4A4E69' },
  buy: {
    minWidth: 84,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryEdge,
  },
  buyDim: { opacity: 0.55 },
  buyText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#8B3FC8',
  },
  offBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8452C',
  },
  offText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bundleBody: { flex: 1, gap: 2 },
  bundleName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  bundleContents: { fontSize: 11, fontWeight: '700', color: '#F1DDFF' },
  price: {
    minWidth: 84,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryEdge,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFF7E6',
  },
  packCoins: { flex: 1, fontSize: 18, fontWeight: '900', color: '#7A5C1E' },
});
