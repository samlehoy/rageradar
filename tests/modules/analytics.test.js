import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsEngine } from '../../src/modules/analytics.js';
import { eventBus } from '../../src/utils/event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSession(overrides = {}) {
  const startedAt = overrides.startedAt || Date.now() - 3600000;
  return {
    id: overrides.id || crypto.randomUUID(),
    startedAt,
    endedAt: overrides.endedAt || startedAt + (overrides.duration || 1800000),
    status: overrides.status || 'completed',
    dataPoints: overrides.dataPoints || [
      { smoothed: 30, raw: 32, timestamp: startedAt + 1000 },
      { smoothed: 45, raw: 48, timestamp: startedAt + 2000 },
      { smoothed: 60, raw: 63, timestamp: startedAt + 3000 },
    ],
    stats: overrides.stats || {
      avg: overrides.avg || 45,
      max: overrides.max || 60,
      spikes: overrides.spikes || 0,
      duration: overrides.duration || 1800000,
      spikesPercent: 0,
      maxTime: startedAt + 3000,
      histogram: [1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    },
  };
}

function createMockSessionManager(sessions = []) {
  return {
    getAllSessions: vi.fn().mockResolvedValue(sessions),
    getSession: vi.fn().mockImplementation(id =>
      Promise.resolve(sessions.find(s => s.id === id)),
    ),
  };
}

/** Create a timestamp for a specific date/time (local). */
function ts(dateStr, hours = 12, minutes = 0) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyticsEngine', () => {
  let engine;
  let sm;

  beforeEach(() => {
    eventBus.clear();
    sm = createMockSessionManager([]);
    engine = new AnalyticsEngine(sm);
  });

  // -----------------------------------------------------------------------
  // Filters out non-completed sessions
  // -----------------------------------------------------------------------
  describe('session filtering', () => {
    it('ignores sessions that are not completed', async () => {
      const sessions = [
        createMockSession({ id: 'a', status: 'active', avg: 20 }),
        createMockSession({ id: 'b', status: 'paused', avg: 30 }),
        createMockSession({ id: 'c', status: 'completed', avg: 40 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const stats = await engine.getOverallStats();
      expect(stats.totalSessions).toBe(1);
      expect(stats.overallAvg).toBe(40);
    });
  });

  // -----------------------------------------------------------------------
  // getTrends()
  // -----------------------------------------------------------------------
  describe('getTrends()', () => {
    it('returns empty arrays when there are 0 sessions', async () => {
      const result = await engine.getTrends();
      expect(result.daily).toEqual([]);
      expect(result.weekly).toEqual([]);
      expect(result.monthly).toEqual([]);
    });

    it('returns a single daily entry for 1 session', async () => {
      const startedAt = ts('2026-06-10');
      const sessions = [createMockSession({ startedAt, avg: 50, max: 80 })];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('all');
      expect(result.daily).toHaveLength(1);
      expect(result.daily[0].date).toBe('2026-06-10');
      expect(result.daily[0].avg).toBe(50);
      expect(result.daily[0].max).toBe(80);
      expect(result.daily[0].sessions).toBe(1);
    });

    it('groups multiple sessions on different days', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2026-06-10'), avg: 40, max: 70 }),
        createMockSession({ startedAt: ts('2026-06-10'), avg: 60, max: 90 }),
        createMockSession({ startedAt: ts('2026-06-11'), avg: 30, max: 50 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('all');
      expect(result.daily).toHaveLength(2);

      const day1 = result.daily.find(d => d.date === '2026-06-10');
      expect(day1.avg).toBe(50); // (40+60)/2
      expect(day1.max).toBe(90);
      expect(day1.sessions).toBe(2);

      const day2 = result.daily.find(d => d.date === '2026-06-11');
      expect(day2.avg).toBe(30);
      expect(day2.sessions).toBe(1);
    });

    it('generates weekly aggregations', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2026-06-08'), avg: 40, max: 60 }), // Mon
        createMockSession({ startedAt: ts('2026-06-09'), avg: 50, max: 70 }), // Tue (same week)
        createMockSession({ startedAt: ts('2026-06-15'), avg: 60, max: 80 }), // Next Mon
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('all');
      expect(result.weekly.length).toBeGreaterThanOrEqual(2);
      expect(result.weekly[0].sessions).toBe(2);
    });

    it('generates monthly aggregations', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2026-05-15'), avg: 30, max: 50 }),
        createMockSession({ startedAt: ts('2026-06-10'), avg: 60, max: 90 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('all');
      expect(result.monthly).toHaveLength(2);
    });

    it('filters by 7d range', async () => {
      const now = Date.now();
      const sessions = [
        createMockSession({ startedAt: now - 3 * 86400000, avg: 50 }),      // 3 days ago → in
        createMockSession({ startedAt: now - 10 * 86400000, avg: 70 }),     // 10 days ago → out
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('7d');
      expect(result.daily).toHaveLength(1);
      expect(result.daily[0].avg).toBe(50);
    });

    it('filters by 30d range', async () => {
      const now = Date.now();
      const sessions = [
        createMockSession({ startedAt: now - 10 * 86400000, avg: 40 }),     // 10 days ago → in
        createMockSession({ startedAt: now - 60 * 86400000, avg: 80 }),     // 60 days ago → out
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('30d');
      expect(result.daily).toHaveLength(1);
      expect(result.daily[0].avg).toBe(40);
    });

    it('filters by 90d range', async () => {
      const now = Date.now();
      const sessions = [
        createMockSession({ startedAt: now - 30 * 86400000, avg: 40 }),     // 30 days ago → in
        createMockSession({ startedAt: now - 120 * 86400000, avg: 80 }),    // 120 days ago → out
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('90d');
      expect(result.daily).toHaveLength(1);
    });

    it('includes all sessions with range "all"', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2020-01-01'), avg: 10 }),
        createMockSession({ startedAt: ts('2026-06-01'), avg: 90 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getTrends('all');
      expect(result.daily).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // getHeatmapData()
  // -----------------------------------------------------------------------
  describe('getHeatmapData()', () => {
    it('returns an entry for every day in the specified month', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      // June 2026 has 30 days
      const result = await engine.getHeatmapData(2026, 5); // 0-based month
      expect(result).toHaveLength(30);
    });

    it('returns 365 or 366 entries for a full year', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getHeatmapData(2026); // full year
      expect(result).toHaveLength(365);
    });

    it('computes correct dayOfWeek', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getHeatmapData(2026, 5); // June 2026
      // June 1 2026 is a Monday → getDay() = 1
      expect(result[0].date).toBe('2026-06-01');
      expect(result[0].dayOfWeek).toBe(1); // Monday
    });

    it('sets avg from session data on matching dates', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2026-06-15'), avg: 72 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getHeatmapData(2026, 5);
      const day15 = result.find(d => d.date === '2026-06-15');
      expect(day15.avg).toBe(72);
      expect(day15.sessions).toBe(1);
    });

    it('sets avg to 0 for days with no sessions', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getHeatmapData(2026, 5);
      expect(result.every(d => d.avg === 0)).toBe(true);
    });

    it('includes weekIndex values', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getHeatmapData(2026, 5);
      // All entries should have a weekIndex >= 0
      result.forEach(d => expect(d.weekIndex).toBeGreaterThanOrEqual(0));
      // The last day should have the largest weekIndex
      const maxWeek = Math.max(...result.map(d => d.weekIndex));
      expect(maxWeek).toBeGreaterThanOrEqual(4);
    });
  });

  // -----------------------------------------------------------------------
  // getPeakAnalysis()
  // -----------------------------------------------------------------------
  describe('getPeakAnalysis()', () => {
    it('returns 24 hour buckets, 7 day-of-week buckets, and 5 duration buckets', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getPeakAnalysis();
      expect(result.byHour).toHaveLength(24);
      expect(result.byDayOfWeek).toHaveLength(7);
      expect(result.byDuration).toHaveLength(5);
    });

    it('groups sessions by hour of day', async () => {
      const sessions = [
        createMockSession({ startedAt: ts('2026-06-10', 9), avg: 40 }),
        createMockSession({ startedAt: ts('2026-06-11', 9), avg: 60 }),
        createMockSession({ startedAt: ts('2026-06-10', 14), avg: 80 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getPeakAnalysis();
      const hour9 = result.byHour.find(h => h.hour === 9);
      expect(hour9.count).toBe(2);
      expect(hour9.avg).toBe(50); // (40+60)/2

      const hour14 = result.byHour.find(h => h.hour === 14);
      expect(hour14.count).toBe(1);
      expect(hour14.avg).toBe(80);
    });

    it('groups sessions by day of week', async () => {
      // 2026-06-08 is Monday (getDay()=1), 2026-06-14 is Sunday (getDay()=0)
      const sessions = [
        createMockSession({ startedAt: ts('2026-06-08'), avg: 30 }),
        createMockSession({ startedAt: ts('2026-06-14'), avg: 70 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getPeakAnalysis();
      expect(result.byDayOfWeek[1].count).toBe(1); // Monday
      expect(result.byDayOfWeek[1].avg).toBe(30);
      expect(result.byDayOfWeek[0].count).toBe(1); // Sunday
      expect(result.byDayOfWeek[0].avg).toBe(70);
    });

    it('buckets sessions by duration', async () => {
      const sessions = [
        createMockSession({ duration: 2 * 60000, avg: 30 }),     // 0-5m
        createMockSession({ duration: 10 * 60000, avg: 50 }),    // 5-15m
        createMockSession({ duration: 20 * 60000, avg: 60 }),    // 15-30m
        createMockSession({ duration: 45 * 60000, avg: 70 }),    // 30-60m
        createMockSession({ duration: 90 * 60000, avg: 90 }),    // 60m+
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getPeakAnalysis();
      expect(result.byDuration[0]).toEqual({ range: '0-5m', avg: 30, count: 1 });
      expect(result.byDuration[1]).toEqual({ range: '5-15m', avg: 50, count: 1 });
      expect(result.byDuration[2]).toEqual({ range: '15-30m', avg: 60, count: 1 });
      expect(result.byDuration[3]).toEqual({ range: '30-60m', avg: 70, count: 1 });
      expect(result.byDuration[4]).toEqual({ range: '60m+', avg: 90, count: 1 });
    });

    it('reports 0 avg and count for empty buckets', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const result = await engine.getPeakAnalysis();
      result.byHour.forEach(b => {
        expect(b.avg).toBe(0);
        expect(b.count).toBe(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // getOverallStats()
  // -----------------------------------------------------------------------
  describe('getOverallStats()', () => {
    it('returns zeros when there are no sessions', async () => {
      const result = await engine.getOverallStats();
      expect(result.totalSessions).toBe(0);
      expect(result.totalDuration).toBe(0);
      expect(result.overallAvg).toBe(0);
      expect(result.bestSession).toBeNull();
      expect(result.worstSession).toBeNull();
    });

    it('calculates totals correctly', async () => {
      const sessions = [
        createMockSession({ id: 's1', duration: 600000, avg: 30, max: 50 }),
        createMockSession({ id: 's2', duration: 1200000, avg: 60, max: 90 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getOverallStats();
      expect(result.totalSessions).toBe(2);
      expect(result.totalDuration).toBe(1800000);
      expect(result.overallAvg).toBe(45); // (30+60)/2
    });

    it('identifies best (lowest avg) and worst (highest avg) sessions', async () => {
      const sessions = [
        createMockSession({ id: 'best', avg: 15 }),
        createMockSession({ id: 'mid', avg: 50 }),
        createMockSession({ id: 'worst', avg: 85 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getOverallStats();
      expect(result.bestSession.id).toBe('best');
      expect(result.bestSession.avg).toBe(15);
      expect(result.worstSession.id).toBe('worst');
      expect(result.worstSession.avg).toBe(85);
    });

    it('provides date strings for best/worst sessions', async () => {
      const sessions = [
        createMockSession({ id: 'a', startedAt: ts('2026-06-15'), avg: 20 }),
        createMockSession({ id: 'b', startedAt: ts('2026-06-20'), avg: 70 }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const result = await engine.getOverallStats();
      expect(result.bestSession.date).toBe('2026-06-15');
      expect(result.worstSession.date).toBe('2026-06-20');
    });
  });

  // -----------------------------------------------------------------------
  // exportCSV()
  // -----------------------------------------------------------------------
  describe('exportCSV()', () => {
    it('returns header row with correct columns', async () => {
      sm.getAllSessions.mockResolvedValue([]);
      const csv = await engine.exportCSV();
      expect(csv).toBe('Date,StartTime,Duration(s),AvgRage,MaxRage,Spikes,SpikesPercent');
    });

    it('has correct row count', async () => {
      const sessions = [
        createMockSession({ id: '1' }),
        createMockSession({ id: '2' }),
        createMockSession({ id: '3' }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const csv = await engine.exportCSV();
      const lines = csv.split('\n');
      expect(lines).toHaveLength(4); // 1 header + 3 rows
    });

    it('formats values correctly', async () => {
      const startedAt = ts('2026-06-10', 14, 30);
      const sessions = [
        createMockSession({
          startedAt,
          stats: { avg: 42.5, max: 88, spikes: 3, duration: 120000, spikesPercent: 15, maxTime: null, histogram: [] },
        }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const csv = await engine.exportCSV();
      const lines = csv.split('\n');
      const row = lines[1].split(',');

      expect(row[0]).toBe('2026-06-10');         // Date
      expect(row[1]).toMatch(/^14:30:00/);        // StartTime
      expect(row[2]).toBe('120');                  // Duration(s)
      expect(row[3]).toBe('42.5');                 // AvgRage
      expect(row[4]).toBe('88');                   // MaxRage
      expect(row[5]).toBe('3');                    // Spikes
      expect(row[6]).toBe('15');                   // SpikesPercent
    });
  });

  // -----------------------------------------------------------------------
  // exportJSON()
  // -----------------------------------------------------------------------
  describe('exportJSON()', () => {
    it('returns valid JSON', async () => {
      const sessions = [createMockSession({ id: 'json-test' })];
      sm.getAllSessions.mockResolvedValue(sessions);

      const json = await engine.exportJSON();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('contains all completed sessions', async () => {
      const sessions = [
        createMockSession({ id: 's1' }),
        createMockSession({ id: 's2' }),
      ];
      sm.getAllSessions.mockResolvedValue(sessions);

      const json = await engine.exportJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed.map(s => s.id)).toEqual(['s1', 's2']);
    });

    it('includes expected fields', async () => {
      const sessions = [createMockSession({ id: 'fields-check' })];
      sm.getAllSessions.mockResolvedValue(sessions);

      const json = await engine.exportJSON();
      const [entry] = JSON.parse(json);
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('startedAt');
      expect(entry).toHaveProperty('endedAt');
      expect(entry).toHaveProperty('duration');
      expect(entry).toHaveProperty('avg');
      expect(entry).toHaveProperty('max');
      expect(entry).toHaveProperty('spikes');
      expect(entry).toHaveProperty('spikesPercent');
      expect(entry).toHaveProperty('dataPoints');
    });
  });

  // -----------------------------------------------------------------------
  // Cache invalidation
  // -----------------------------------------------------------------------
  describe('cache invalidation', () => {
    it('uses cached results on second call', async () => {
      const sessions = [createMockSession()];
      sm.getAllSessions.mockResolvedValue(sessions);

      await engine.getOverallStats();
      await engine.getOverallStats();
      // Should only have called getAllSessions once (cached)
      expect(sm.getAllSessions).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after invalidateCache()', async () => {
      const sessions = [createMockSession({ avg: 30 })];
      sm.getAllSessions.mockResolvedValue(sessions);

      const first = await engine.getOverallStats();
      expect(first.overallAvg).toBe(30);

      // Update mock data and invalidate
      const updated = [createMockSession({ avg: 80 })];
      sm.getAllSessions.mockResolvedValue(updated);
      engine.invalidateCache();

      const second = await engine.getOverallStats();
      expect(second.overallAvg).toBe(80);
      expect(sm.getAllSessions).toHaveBeenCalledTimes(2);
    });

    it('invalidates on session:stopped event', async () => {
      const sessions = [createMockSession({ avg: 40 })];
      sm.getAllSessions.mockResolvedValue(sessions);

      await engine.getOverallStats();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(1);

      // Emit event — should clear cache
      eventBus.emit('session:stopped', { id: 'test' });

      await engine.getOverallStats();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(2);
    });

    it('invalidates on session:auto-saved event', async () => {
      const sessions = [createMockSession({ avg: 55 })];
      sm.getAllSessions.mockResolvedValue(sessions);

      await engine.getOverallStats();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(1);

      eventBus.emit('session:auto-saved', { id: 'test' });

      await engine.getOverallStats();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(2);
    });

    it('invalidates all cache keys', async () => {
      const sessions = [createMockSession()];
      sm.getAllSessions.mockResolvedValue(sessions);

      // Populate multiple cache entries
      await engine.getOverallStats();
      await engine.getTrends('all');
      await engine.getPeakAnalysis();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(3);

      engine.invalidateCache();

      await engine.getOverallStats();
      await engine.getTrends('all');
      await engine.getPeakAnalysis();
      expect(sm.getAllSessions).toHaveBeenCalledTimes(6);
    });
  });
});
