import { eventBus } from '../utils/event-bus.js';

/**
 * Analytics Engine — aggregates completed session data for charts, heatmaps,
 * peak-analysis and export.  Pure computation, no DOM dependency.
 *
 * All public query methods are async so callers can always `await` them,
 * even though the current backing store (SessionManager) is in-memory/IDB.
 */
export class AnalyticsEngine {
  /**
   * @param {import('./session.js').SessionManager} sessionManager
   */
  constructor(sessionManager) {
    this._sm = sessionManager;
    this._cache = {};

    // Invalidate cache whenever a session finalises or auto-saves
    this._unsubStop = eventBus.on('session:stopped', () => this.invalidateCache());
    this._unsubSave = eventBus.on('session:auto-saved', () => this.invalidateCache());
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get trend data for line charts.
   * @param {'7d'|'30d'|'90d'|'all'} range
   * @returns {Promise<{daily: Array, weekly: Array, monthly: Array}>}
   */
  async getTrends(range = '30d') {
    const cacheKey = `trends:${range}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    const sessions = await this._completedSessions();
    const cutoff = this._rangeCutoff(range);
    const filtered = sessions.filter(s => s.startedAt >= cutoff);

    // --- daily ---
    const byDate = new Map();
    for (const s of filtered) {
      const key = this._dateKey(s.startedAt);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(s);
    }

    const daily = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, group]) => ({
        date,
        avg: this._round(this._mean(group.map(s => s.stats.avg))),
        max: Math.max(...group.map(s => s.stats.max)),
        sessions: group.length,
        duration: group.reduce((t, s) => t + s.stats.duration, 0),
      }));

    // --- weekly ---
    const byWeek = new Map();
    for (const d of daily) {
      const wk = this._isoWeekKey(d.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk).push(d);
    }

    const weekly = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, days]) => ({
        week,
        avg: this._round(this._mean(days.map(d => d.avg))),
        max: Math.max(...days.map(d => d.max)),
        sessions: days.reduce((t, d) => t + d.sessions, 0),
        duration: days.reduce((t, d) => t + d.duration, 0),
      }));

    // --- monthly ---
    const byMonth = new Map();
    for (const d of daily) {
      const mk = d.date.slice(0, 7); // YYYY-MM
      if (!byMonth.has(mk)) byMonth.set(mk, []);
      byMonth.get(mk).push(d);
    }

    const monthly = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, days]) => ({
        month,
        avg: this._round(this._mean(days.map(d => d.avg))),
        max: Math.max(...days.map(d => d.max)),
        sessions: days.reduce((t, d) => t + d.sessions, 0),
        duration: days.reduce((t, d) => t + d.duration, 0),
      }));

    const result = { daily, weekly, monthly };
    this._cache[cacheKey] = result;
    return result;
  }

  /**
   * Get calendar heatmap data suitable for chartjs-chart-matrix.
   * @param {number} year
   * @param {number|null} month — 0-based; null = full year
   * @returns {Promise<Array<{date: string, dayOfWeek: number, weekIndex: number, avg: number, sessions: number}>>}
   */
  async getHeatmapData(year, month = null) {
    const cacheKey = `heatmap:${year}:${month}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    const sessions = await this._completedSessions();

    // Build a map of date → sessions
    const byDate = new Map();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      if (d.getFullYear() !== year) continue;
      if (month !== null && d.getMonth() !== month) continue;
      const key = this._dateKey(s.startedAt);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(s);
    }

    // Determine the range of dates to cover
    let start, end;
    if (month !== null) {
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0); // last day of month
    } else {
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
    }

    // Compute the weekIndex offset: the first week starts at the first day
    const firstDayOfRange = new Date(start);
    const result = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = this._dateKeyFromDate(d);
      const dayOfWeek = d.getDay(); // 0 = Sunday
      const daysSinceStart = Math.floor((d - firstDayOfRange) / 86400000);
      const weekIndex = Math.floor((daysSinceStart + firstDayOfRange.getDay()) / 7);

      const group = byDate.get(key) || [];
      result.push({
        date: key,
        dayOfWeek,
        weekIndex,
        avg: group.length ? this._round(this._mean(group.map(s => s.stats.avg))) : 0,
        sessions: group.length,
      });
    }

    this._cache[cacheKey] = result;
    return result;
  }

  /**
   * Peak analysis for bar charts.
   * @returns {Promise<{byHour: Array, byDayOfWeek: Array, byDuration: Array}>}
   */
  async getPeakAnalysis() {
    if (this._cache.peak) return this._cache.peak;

    const sessions = await this._completedSessions();

    // --- by hour of day ---
    const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, total: 0, count: 0 }));
    for (const s of sessions) {
      const h = new Date(s.startedAt).getHours();
      hourBuckets[h].total += s.stats.avg;
      hourBuckets[h].count += 1;
    }
    const byHour = hourBuckets.map(b => ({
      hour: b.hour,
      avg: b.count ? this._round(b.total / b.count) : 0,
      count: b.count,
    }));

    // --- by day of week ---
    const dayBuckets = Array.from({ length: 7 }, (_, i) => ({ day: i, total: 0, count: 0 }));
    for (const s of sessions) {
      const d = new Date(s.startedAt).getDay();
      dayBuckets[d].total += s.stats.avg;
      dayBuckets[d].count += 1;
    }
    const byDayOfWeek = dayBuckets.map(b => ({
      day: b.day,
      avg: b.count ? this._round(b.total / b.count) : 0,
      count: b.count,
    }));

    // --- by duration ---
    const durationRanges = [
      { range: '0-5m', min: 0, max: 5 * 60000 },
      { range: '5-15m', min: 5 * 60000, max: 15 * 60000 },
      { range: '15-30m', min: 15 * 60000, max: 30 * 60000 },
      { range: '30-60m', min: 30 * 60000, max: 60 * 60000 },
      { range: '60m+', min: 60 * 60000, max: Infinity },
    ];
    const byDuration = durationRanges.map(({ range, min, max }) => {
      const group = sessions.filter(s => s.stats.duration >= min && s.stats.duration < max);
      return {
        range,
        avg: group.length ? this._round(this._mean(group.map(s => s.stats.avg))) : 0,
        count: group.length,
      };
    });

    const result = { byHour, byDayOfWeek, byDuration };
    this._cache.peak = result;
    return result;
  }

  /**
   * Overall summary statistics.
   * @returns {Promise<{totalSessions: number, totalDuration: number, overallAvg: number, bestSession: Object|null, worstSession: Object|null}>}
   */
  async getOverallStats() {
    if (this._cache.overall) return this._cache.overall;

    const sessions = await this._completedSessions();
    if (sessions.length === 0) {
      const empty = { totalSessions: 0, totalDuration: 0, overallAvg: 0, bestSession: null, worstSession: null };
      this._cache.overall = empty;
      return empty;
    }

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((t, s) => t + s.stats.duration, 0);
    const overallAvg = this._round(this._mean(sessions.map(s => s.stats.avg)));

    let best = sessions[0];
    let worst = sessions[0];
    for (const s of sessions) {
      if (s.stats.avg < best.stats.avg) best = s;
      if (s.stats.avg > worst.stats.avg) worst = s;
    }

    const result = {
      totalSessions,
      totalDuration,
      overallAvg,
      bestSession: { id: best.id, avg: best.stats.avg, date: this._dateKey(best.startedAt) },
      worstSession: { id: worst.id, avg: worst.stats.avg, date: this._dateKey(worst.startedAt) },
    };
    this._cache.overall = result;
    return result;
  }

  /**
   * Export all completed sessions as a CSV string.
   * Columns: Date, StartTime, Duration(s), AvgRage, MaxRage, Spikes, SpikesPercent
   */
  async exportCSV() {
    const sessions = await this._completedSessions();
    const header = 'Date,StartTime,Duration(s),AvgRage,MaxRage,Spikes,SpikesPercent';
    const rows = sessions.map(s => {
      const d = new Date(s.startedAt);
      const date = this._dateKey(s.startedAt);
      const startTime = d.toTimeString().slice(0, 8); // HH:MM:SS
      const durationSec = Math.round(s.stats.duration / 1000);
      return [date, startTime, durationSec, s.stats.avg, s.stats.max, s.stats.spikes, s.stats.spikesPercent].join(',');
    });
    return [header, ...rows].join('\n');
  }

  /**
   * Export all completed sessions as a formatted JSON string.
   */
  async exportJSON() {
    const sessions = await this._completedSessions();
    const data = sessions.map(s => ({
      id: s.id,
      date: this._dateKey(s.startedAt),
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      duration: s.stats.duration,
      avg: s.stats.avg,
      max: s.stats.max,
      spikes: s.stats.spikes,
      spikesPercent: s.stats.spikesPercent,
      dataPoints: s.dataPoints.length,
    }));
    return JSON.stringify(data, null, 2);
  }

  /**
   * Invalidate the in-memory cache.  Call when new session data arrives.
   */
  invalidateCache() {
    this._cache = {};
  }

  /**
   * Unsubscribe from event bus (for cleanup).
   */
  destroy() {
    this._unsubStop?.();
    this._unsubSave?.();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Fetch only completed sessions from the SessionManager. */
  async _completedSessions() {
    const all = await this._sm.getAllSessions();
    return all.filter(s => s.status === 'completed');
  }

  /** Round to 1 decimal place. */
  _round(n) {
    return Math.round(n * 10) / 10;
  }

  /** Arithmetic mean of an array. */
  _mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /** Convert a range string to a Unix-ms cutoff timestamp. */
  _rangeCutoff(range) {
    if (range === 'all') return 0;
    const days = { '7d': 7, '30d': 30, '90d': 90 };
    const d = days[range] || 30;
    return Date.now() - d * 86400000;
  }

  /** YYYY-MM-DD from a Unix-ms timestamp. */
  _dateKey(ts) {
    return this._dateKeyFromDate(new Date(ts));
  }

  /** YYYY-MM-DD from a Date object. */
  _dateKeyFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** ISO-8601 week key (YYYY-WNN) from a YYYY-MM-DD string. */
  _isoWeekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    // ISO week: Monday-based, week 1 contains Jan 4
    const dayOfWeek = d.getDay() || 7; // Mon=1 … Sun=7
    d.setDate(d.getDate() + 4 - dayOfWeek); // Thursday of the same ISO week
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}
