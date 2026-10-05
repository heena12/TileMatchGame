export type AppVisibility = 'active' | 'background';

/** Tells the app when the player leaves it or comes back. */
export interface IAppLifecycle {
  /** Returns a function that stops listening. */
  subscribe(listener: (state: AppVisibility) => void): () => void;
}
