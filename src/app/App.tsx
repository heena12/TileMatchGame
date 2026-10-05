import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '@navigation/RootNavigator';
import type { Container } from './di/container';
import { createContainer } from './di/container';
import { AppProviders } from './providers/AppProviders';

interface Props {
  /** Injectable for tests. */
  container?: Container;
}

export default function App({ container }: Props) {
  const resolved = useMemo(() => container ?? createContainer(), [container]);

  useEffect(() => {
    resolved.analytics.track({ name: 'app_open' });
    return resolved.start();
  }, [resolved]);

  return (
    <AppProviders model={resolved.model}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppProviders>
  );
}
