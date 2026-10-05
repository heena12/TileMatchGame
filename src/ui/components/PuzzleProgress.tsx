import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PUZZLE_PIECES, puzzlePiecesRevealed } from '@state/puzzle';
import { PuzzleFrame } from '@ui/components/PuzzleFrame';
import { textOutline } from '@ui/theme/tokens';

/**
 * The picture box on the win screen: the same frame as on Home, one piece
 * more filled in, with the newest piece flashing in after the coins have flown.
 */
export function PuzzleProgress({
  levelId,
  animate,
  bonus,
}: {
  levelId: number;
  animate: boolean;
  bonus: number;
}) {
  const revealed = puzzlePiecesRevealed(levelId);
  return (
    <View style={styles.wrap}>
      <PuzzleFrame
        revealed={revealed}
        pieceSize={58}
        playKey={animate ? 1 : 0}
        revealDelayMs={500}
      />
      {revealed === PUZZLE_PIECES ? (
        <Text style={styles.done}>
          {bonus > 0
            ? `Picture complete! +${bonus} coins`
            : 'Picture complete!'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingTop: 10 },
  done: { fontSize: 14, fontWeight: '900', color: '#FFE45C', ...textOutline },
});
