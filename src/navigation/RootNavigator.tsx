import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ChapterIntroScreen,
  GameScreen,
  HomeScreen,
  LeaderboardScreen,
  LevelMapScreen,
  ResultScreen,
  ShopScreen,
  SplashScreen,
} from '@ui/screens';
import { withFadeIn } from '@ui/components/withFadeIn';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors } from '@ui/theme/tokens';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Each screen fades in as it opens, the same on web and on phones.
const Home = withFadeIn(HomeScreen);
const LevelMap = withFadeIn(LevelMapScreen);
const Game = withFadeIn(GameScreen);
const Shop = withFadeIn(ShopScreen);
const ChapterIntro = withFadeIn(ChapterIntroScreen);
const Result = withFadeIn(ResultScreen);

export function RootNavigator() {
  useLanguage();
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        animation: 'fade',
        animationDuration: 300,
        contentStyle: { backgroundColor: colors.background },
        headerTintColor: colors.onBackground,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Home"
        component={Home}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LevelMap"
        component={LevelMap}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChapterIntro"
        component={ChapterIntro}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Game"
        component={Game}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Result"
        component={Result}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Shop"
        component={Shop}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: t('board.title') }}
      />
    </Stack.Navigator>
  );
}
