import type { AppVisibility, IAppLifecycle } from './IAppLifecycle';

/** Lifecycle driven by hand. Used by tests. */
export class ManualLifecycle implements IAppLifecycle {
  private listeners = new Set<(state: AppVisibility) => void>();

  subscribe(listener: (state: AppVisibility) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(state: AppVisibility): void {
    this.listeners.forEach(listener => listener(state));
  }
}
