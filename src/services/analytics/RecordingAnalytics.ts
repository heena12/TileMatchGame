import type { AnalyticsEvent, IAnalytics } from './IAnalytics';

/** Keeps events in memory. Used by tests and handy for debugging. */
export class RecordingAnalytics implements IAnalytics {
  readonly events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events.push(event);
  }
}
