import { AppState } from 'react-native';
import type { AppVisibility, IAppLifecycle } from './IAppLifecycle';

/** React Native's AppState (also supported by react-native-web). */
export class AppStateLifecycle implements IAppLifecycle {
  subscribe(listener: (state: AppVisibility) => void): () => void {
    const subscription = AppState.addEventListener('change', next => {
      // "inactive" is a brief iOS overlay (call, app switcher), not a departure.
      if (next === 'active' || next === 'background') {
        listener(next);
      }
    });
    return () => subscription.remove();
  }
}
