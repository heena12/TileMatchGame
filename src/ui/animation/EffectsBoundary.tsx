import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Called once when the effects failed, for logging. */
  onError?: (error: unknown) => void;
}

interface State {
  failed: boolean;
}

/**
 * Animations are decoration. If drawing them ever throws, this drops them for
 * the rest of the screen's life and the game carries on unaffected.
 */
export class EffectsBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
