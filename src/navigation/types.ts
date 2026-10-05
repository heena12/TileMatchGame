import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  LevelMap: undefined;
  /** `tutorial` forces the guided steps (replay from Settings); `resume` picks up the saved game. */
  /** Shown before the first level of each chapter. */
  ChapterIntro: { levelId: number };
  Game: { levelId: number; tutorial?: boolean; resume?: boolean };
  Result: { levelId: number; won: boolean; tutorial?: boolean };
  Shop: undefined;
  Leaderboard: { levelId: number };
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
