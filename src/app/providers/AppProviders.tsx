import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppModelProvider } from '@state/StoresContext';
import type { AppModel } from '@state/StoresContext';

export function AppProviders({
  model,
  children,
}: {
  model: AppModel;
  children: React.ReactNode;
}) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppModelProvider model={model}>{children}</AppModelProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
