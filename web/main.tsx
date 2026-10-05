/// <reference types="vite/client" />
import './motionOverride';
import React from 'react';
import { AppRegistry } from 'react-native';
import App from '../src/app/App';
import type { Container } from '../src/app/di/container';

// The web build runs in a browser; the shared tsconfig has no DOM types.
const dom = globalThis as unknown as {
  document: { getElementById(id: string): unknown };
  location: { search: string };
};

async function start() {
  let container: Container | undefined;
  // Development only (compiled out of production builds): open the app with
  // ?demoCloud to try cloud save and the leaderboard against an in-memory server.
  if (import.meta.env.DEV && /[?&]demoCloud\b/.test(dom.location.search)) {
    const { createDemoContainer } = await import('./demoCloud');
    container = await createDemoContainer();
  }

  AppRegistry.registerComponent('TileMatchGame', () => () => (
    <App container={container} />
  ));
  AppRegistry.runApplication('TileMatchGame', {
    initialProps: {},
    // react-native-web takes a DOM element; the native RootTag type is a symbol.
    rootTag: dom.document.getElementById('root') as never,
  });
}

start();
