import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chapterFor, chapterRange } from '@config/chapters';
import type { RootScreenProps } from '@navigation/types';
import { textOutline } from '@ui/theme/tokens';

const AUTO_ADVANCE_MS = 3200;

/** "Eiffel Tower - Level 5-8": shown for a moment before a new chapter's first level. */
export function ChapterIntroScreen({
  navigation,
  route,
}: RootScreenProps<'ChapterIntro'>) {
  const { levelId } = route.params;
  const chapter = chapterFor(levelId);
  const insets = useSafeAreaInsets();
  const go = useCallback(
    () => navigation.replace('Game', { levelId }),
    [navigation, levelId],
  );

  useEffect(() => {
    const id = setTimeout(go, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [go]);

  return (
    <Pressable
      testID="chapter-intro"
      accessibilityRole="button"
      accessibilityLabel={`${chapter.name}. Tap to start`}
      onPress={go}
      style={[styles.container, { paddingTop: 48 + insets.top }]}
    >
      <View pointerEvents="none" style={styles.skyLow} />
      <View pointerEvents="none" style={styles.water} />
      <Animated.View entering={FadeIn.duration(500)} style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {chapter.name}
        </Text>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>
            {`Level ${chapterRange(levelId)}`}
          </Text>
        </View>
        <Text style={styles.description}>{chapter.description}</Text>
      </Animated.View>
      <Text pointerEvents="none" style={styles.landmark}>
        {chapter.glyph}
      </Text>
      <Text pointerEvents="none" style={styles.hint}>
        Tap to start
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', backgroundColor: '#2A6FE8' },
  skyLow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    bottom: 0,
    backgroundColor: '#5BB6F5',
  },
  water: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
    backgroundColor: '#2FB4F0',
  },
  content: { alignItems: 'center', paddingHorizontal: 28, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', ...textOutline },
  ribbon: {
    paddingHorizontal: 26,
    paddingVertical: 4,
    backgroundColor: '#1F5FC8',
  },
  ribbonText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  description: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 26,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  landmark: { position: 'absolute', bottom: '24%', fontSize: 150 },
  hint: {
    position: 'absolute',
    bottom: 36,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
});
