import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useGameController, useTutorial } from '@state/StoresContext';
import { currentStep } from '@state/tutorialStore';
import { Button } from '@ui/components/Button';
import { t, textForKey } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, fontSize, radius, spacing } from '@ui/theme/tokens';

/**
 * The teaching panel shown above the board while a tutorial step is active:
 * the message, "Got it" for message-only steps, and a way out.
 */
export function TutorialCoach() {
  useLanguage();
  const controller = useGameController();
  const step = useTutorial(s => currentStep(s));
  const index = useTutorial(s => s.index);
  const nudged = useTutorial(s => s.nudged);

  if (!step) {
    return null;
  }

  return (
    <View
      testID="tutorial-coach"
      accessibilityLiveRegion="polite"
      style={styles.panel}
    >
      {/* A new key re-mounts the text so it pops in with each step. */}
      <Animated.Text
        key={index}
        entering={ZoomIn.duration(180)}
        testID="tutorial-message"
        style={styles.message}
      >
        {textForKey(step.messageKey)}
      </Animated.Text>

      {nudged && step.waitFor === 'select' ? (
        <Text testID="tutorial-nudge" style={styles.nudge}>
          {t('tutorial.nudge')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {step.waitFor === 'tap' ? (
          <Button
            testID="tutorial-continue"
            title={t('tutorial.gotIt')}
            onPress={() => controller.tutorialContinue()}
          />
        ) : null}
        <Button
          testID="tutorial-skip"
          variant="secondary"
          title={t('tutorial.skip')}
          onPress={() => controller.skipTutorial()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  message: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  nudge: {
    fontSize: fontSize.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
