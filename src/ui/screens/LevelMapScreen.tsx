import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '@config/constants';
import {
  REGION_COUNT,
  levelForSlot,
  regionAt,
  regionIndexOf,
  slotState,
} from '@config/regions';
import type { MapRegion, MapSlot, SlotState } from '@config/regions';
import { startLevel } from '@navigation/startLevel';
import type { RootScreenProps } from '@navigation/types';
import { useProgress } from '@state/StoresContext';
import { LockIcon } from '@ui/components/LockIcon';
import { RoundButton } from '@ui/components/RoundButton';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, textOutline } from '@ui/theme/tokens';

/** Painted scenes stand in for the pictures revealed as levels are cleared. */
const PICTURES = [
  { glyph: '🌸', style: 'lavender' },
  { glyph: '🗼', style: 'sea' },
  { glyph: '🏰', style: 'dawn' },
  { glyph: '⛰️', style: 'meadow' },
  { glyph: '🌅', style: 'sunset' },
] as const;

/** Fixed height of one country card plus the gap below it, for instant jumps. */
const CARD_HEIGHT = 168;
const CARD_GAP = 12;
const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;

interface SlotProps {
  regionIndex: number;
  slotIndex: number;
  slot: MapSlot;
  state: SlotState;
  onSelect: (slot: MapSlot) => void;
}

const SlotView = memo(function SlotViewImpl({
  regionIndex,
  slotIndex,
  slot,
  state,
  onSelect,
}: SlotProps) {
  const picture = PICTURES[(regionIndex * 5 + slotIndex) % PICTURES.length];
  const label =
    state === 'locked'
      ? t('map.locked', { level: slot.first })
      : t('map.range', { first: slot.first, last: slot.last });
  return (
    <Pressable
      testID={`map-slot-${regionIndex}-${slotIndex}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: state === 'locked' }}
      disabled={state === 'locked'}
      onPress={() => onSelect(slot)}
      style={({ pressed }) => [
        styles.slot,
        state === 'locked' && styles.slotLocked,
        state === 'current' && styles.slotCurrent,
        state === 'done' && picture && SCENE_STYLES[picture.style],
        pressed && styles.pressed,
      ]}
    >
      {state === 'locked' ? <LockIcon size={26} /> : null}
      {state === 'current' ? (
        <>
          <Text style={styles.slotNumber}>{slot.first}</Text>
          <Text style={styles.play}>▶</Text>
        </>
      ) : null}
      {state === 'done' ? (
        <Text style={styles.sceneGlyph}>{picture?.glyph}</Text>
      ) : null}
    </Pressable>
  );
});

interface CardProps {
  region: MapRegion;
  highest: number;
  onSelect: (slot: MapSlot) => void;
  /** Position among the first cards shown, for the staggered fade-in; -1 for none. */
  order: number;
  /** Only here so a change of language re-draws the card (it is memoized). */
  language: string;
}

const RegionCard = memo(function RegionCardView({
  region,
  highest,
  onSelect,
  order,
}: CardProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      testID={`map-region-${region.index}`}
      style={styles.card}
      entering={
        reduced || order < 0
          ? undefined
          : FadeIn.duration(320).delay(120 + order * 90)
      }
    >
      <Text accessibilityRole="header" style={styles.regionName}>
        {region.name}
      </Text>
      <View style={styles.rangePill}>
        <Text style={styles.rangeText}>
          {t('map.range', { first: region.first, last: region.last })}
        </Text>
      </View>
      <View style={styles.slots}>
        {region.slots.map((slot, i) => (
          <SlotView
            key={slot.first}
            regionIndex={region.index}
            slotIndex={i}
            slot={slot}
            state={slotState(slot, highest)}
            onSelect={onSelect}
          />
        ))}
      </View>
    </Animated.View>
  );
});

const REGIONS = Array.from({ length: REGION_COUNT }, (_, i) => i);

export function LevelMapScreen({ navigation }: RootScreenProps<'LevelMap'>) {
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const highest = useProgress(s => s.highestUnlockedLevel);

  const onSelect = useCallback(
    (slot: MapSlot) =>
      startLevel(navigation, levelForSlot(slot, highest), 'navigate'),
    [navigation, highest],
  );

  // Open on the country holding the next level to play.
  const startIndex = Math.min(
    REGION_COUNT - 1,
    regionIndexOf(Math.min(highest, APP_CONFIG.maxLevels)),
  );

  return (
    <View testID="level-map" style={styles.container}>
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <View style={styles.back}>
          <RoundButton
            testID="level-map-back"
            glyph="←"
            label={t('map.back')}
            onPress={() => navigation.goBack()}
          />
        </View>
        <View style={styles.logo}>
          <Text style={styles.logoTop}>TILE</Text>
          <Text style={styles.logoSub}>Explorer</Text>
        </View>
      </View>
      <FlatList
        data={REGIONS}
        keyExtractor={index => String(index)}
        renderItem={({ item }) => (
          <RegionCard
            region={regionAt(item)}
            highest={highest}
            onSelect={onSelect}
            language={language}
            order={
              item >= startIndex && item - startIndex < 6
                ? item - startIndex
                : -1
            }
          />
        )}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={startIndex}
        initialNumToRender={6}
        windowSize={5}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const SCENE_STYLES = StyleSheet.create({
  lavender: { backgroundColor: '#8E64C8' },
  sea: { backgroundColor: '#35B6EE' },
  dawn: { backgroundColor: '#F2A9B8' },
  meadow: { backgroundColor: '#7CCB6A' },
  sunset: { backgroundColor: '#F4A94E' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3D80DC' },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    backgroundColor: '#3D80DC',
  },
  back: { position: 'absolute', left: 12, bottom: 4 },
  logo: {
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F29B22',
    borderBottomWidth: 4,
    borderBottomColor: '#CC3D1D',
    transform: [{ rotate: '-2deg' }],
  },
  logoTop: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  logoSub: { fontSize: 11, fontWeight: '800', color: '#FFF4C7' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    height: CARD_HEIGHT,
    marginBottom: CARD_GAP,
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(36, 76, 160, 0.55)',
  },
  regionName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#FBE6D6',
  },
  rangeText: { fontSize: 11, fontWeight: '800', color: '#5A4A3C' },
  slots: { flexDirection: 'row', gap: 6, marginTop: 4 },
  slot: {
    width: 62,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  slotLocked: { backgroundColor: 'rgba(120, 140, 175, 0.85)' },
  slotCurrent: { backgroundColor: colors.primary },
  slotNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.onBackground,
    ...textOutline,
  },
  play: { fontSize: 14, color: colors.onBackground },
  sceneGlyph: { fontSize: 30 },
  pressed: { opacity: 0.8 },
});
