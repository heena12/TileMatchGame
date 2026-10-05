import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { transitionConfig } from '@ui/animation/transitionConfig';

/** How long a screen takes to fade in, as in the reference game (ms). */
export const SCREEN_FADE_MS = 280;

/** The slice of a navigation object this wrapper needs. */
interface NavigationLike {
  navigate: (...args: never[]) => void;
  replace: (...args: never[]) => void;
  goBack: () => void;
  popToTop: () => void;
  isFocused: () => boolean;
  addListener: (event: 'focus', callback: () => void) => () => void;
}

/**
 * Wraps a screen with the reference game's transition: the screen you leave
 * fades out, then the next one fades in. It works the same on web and on
 * phones, and is skipped with reduced motion.
 *
 * The screen's own `navigation` calls are wrapped, so every button that moves
 * to another screen gets the exit fade without each screen knowing about it.
 */
export function withFadeIn<P extends object>(
  Screen: React.ComponentType<P>,
): React.ComponentType<P> {
  function FadedScreen(props: P) {
    const reduced = useReducedMotion();
    const opacity = useSharedValue(1);
    const leaving = useRef(false);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const nav = (props as { navigation?: NavigationLike }).navigation;

    // Coming back to this screen (a back press) shows it again at once.
    useEffect(() => {
      const unsubscribe = nav?.addListener('focus', () => {
        opacity.value = 1;
        leaving.current = false;
      });
      return unsubscribe;
    }, [nav, opacity]);

    useEffect(() => {
      const pending = timers.current;
      return () => pending.forEach(clearTimeout);
    }, []);

    const wrapped = useMemo(() => {
      if (!nav) {
        return undefined;
      }
      const withExit =
        <A extends never[]>(go: (...args: A) => void) =>
        (...args: A) => {
          if (reduced || transitionConfig.exitMs <= 0) {
            go(...args);
            return;
          }
          if (leaving.current) {
            return;
          }
          leaving.current = true;
          opacity.value = withTiming(0, { duration: transitionConfig.exitMs });
          timers.current.push(
            setTimeout(() => {
              go(...args);
              // If we are still the visible screen (navigation was refused),
              // bring the content back instead of leaving it blank.
              timers.current.push(
                setTimeout(() => {
                  if (nav.isFocused()) {
                    opacity.value = 1;
                    leaving.current = false;
                  }
                }, 500),
              );
            }, transitionConfig.exitMs),
          );
        };
      return {
        ...nav,
        navigate: withExit(nav.navigate),
        replace: withExit(nav.replace),
        goBack: withExit(nav.goBack),
        popToTop: withExit(nav.popToTop),
      };
    }, [nav, reduced, opacity]);

    const fadeOut = useAnimatedStyle(
      () => ({ opacity: opacity.value }),
      [opacity],
    );

    const screenProps = wrapped ? { ...props, navigation: wrapped } : props;
    return (
      <Animated.View
        style={styles.fill}
        entering={reduced ? undefined : FadeIn.duration(SCREEN_FADE_MS)}
      >
        <Animated.View style={[styles.fill, fadeOut]}>
          <Screen {...(screenProps as P)} />
        </Animated.View>
      </Animated.View>
    );
  }
  FadedScreen.displayName = `FadeIn(${Screen.displayName ?? Screen.name})`;
  return FadedScreen;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
