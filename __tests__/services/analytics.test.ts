import { NoopAnalytics } from '@services/analytics/NoopAnalytics';
import { RecordingAnalytics } from '@services/analytics/RecordingAnalytics';

describe('analytics', () => {
  it('NoopAnalytics accepts events and does nothing', () => {
    expect(() => new NoopAnalytics().track({ name: 'app_open' })).not.toThrow();
  });

  it('RecordingAnalytics keeps events in order', () => {
    const a = new RecordingAnalytics();
    a.track({ name: 'app_open' });
    a.track({ name: 'level_start', levelId: 2 });
    expect(a.events).toEqual([
      { name: 'app_open' },
      { name: 'level_start', levelId: 2 },
    ]);
  });
});
