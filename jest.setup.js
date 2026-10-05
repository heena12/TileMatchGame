/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

// Navigation happens at once in tests; the exit fade is checked in the web build.
require('./src/ui/animation/transitionConfig').transitionConfig.exitMs = 0;
require('./src/ui/animation/transitionConfig').transitionConfig.modalMs = 0;

// Reanimated's own Jest mock needs its native runtime to initialise, which
// Node does not have. The app only uses the small surface below, so tests get
// a plain stand-in: animated components are ordinary views, values are plain
// objects, and timing helpers return their target at once. Real animation is
// checked in the web build. Tests can switch on "reduce motion" with
// `global.__REDUCED_MOTION__ = true`.
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const layoutAnimation = {
    duration() {
      return this;
    },
    delay() {
      return this;
    },
    springify() {
      return this;
    },
    withInitialValues() {
      return this;
    },
    damping() {
      return this;
    },
    stiffness() {
      return this;
    },
  };
  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: component => component },
    useSharedValue: initial => ({ value: initial }),
    useAnimatedStyle: compute => compute(),
    withTiming: target => target,
    withDelay: (_delay, animation) => animation,
    withRepeat: animation => animation,
    withSequence: (...steps) => steps[steps.length - 1],
    Easing: {
      out: fn => fn,
      in: fn => fn,
      inOut: fn => fn,
      cubic: t => t,
      quad: t => t,
      linear: t => t,
    },
    ZoomIn: layoutAnimation,
    Keyframe: class {
      delay() {
        return this;
      }
      duration() {
        return this;
      }
    },
    FadeIn: layoutAnimation,
    FadeInUp: layoutAnimation,
    FadeOut: layoutAnimation,
    FadeInDown: layoutAnimation,
    LinearTransition: {
      springify() {
        return this;
      },
      damping() {
        return this;
      },
      stiffness() {
        return this;
      },
    },
    useReducedMotion: () => global.__REDUCED_MOTION__ === true,
  };
});

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);

// Native MMKV is unavailable in Node; a Map-backed fake exposes the same API.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const map = new Map();
    return {
      set: (k, v) => {
        map.set(k, v);
      },
      getString: k => (typeof map.get(k) === 'string' ? map.get(k) : undefined),
      getNumber: k => (typeof map.get(k) === 'number' ? map.get(k) : undefined),
      contains: k => map.has(k),
      remove: k => map.delete(k),
      getAllKeys: () => Array.from(map.keys()),
      clearAll: () => map.clear(),
    };
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
