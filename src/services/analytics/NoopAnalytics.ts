import type { AnalyticsEvent, IAnalytics } from './IAnalytics';

/** Default until a backend is chosen. */
export class NoopAnalytics implements IAnalytics {
  track(_event: AnalyticsEvent): void {}
}
