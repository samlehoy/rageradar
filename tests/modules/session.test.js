import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SessionManager } from '../../src/modules/session.js';
import { eventBus } from '../../src/utils/event-bus.js';

describe('SessionManager', () => {
  let manager;

  beforeEach(async () => {
    eventBus.clear();
    manager = new SessionManager();
    await manager.init();
  });

  afterEach(async () => {
    manager._unsub?.();
    if (manager._saveIntervalId) {
      clearInterval(manager._saveIntervalId);
      manager._saveIntervalId = null;
    }
    manager.currentSession = null;
    // Close DB and delete to prevent state leaking between tests
    if (manager.db) {
      manager.db.close();
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('rageradar');
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    }
  });

  it('should init and open IndexedDB', () => {
    expect(manager.db).toBeTruthy();
  });

  describe('start', () => {
    it('should create a new active session', async () => {
      const session = await manager.start();

      expect(session).toHaveProperty('id');
      expect(session.status).toBe('active');
      expect(session.dataPoints).toEqual([]);
      expect(session.stats).toEqual({ avg: 0, max: 0, spikes: 0, duration: 0 });
      expect(session.startedAt).toBeGreaterThan(0);
      expect(session.endedAt).toBeNull();
    });

    it('should emit session:started event', async () => {
      const listener = vi.fn();
      eventBus.on('session:started', listener);

      await manager.start();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0]).toHaveProperty('id');
    });

    it('should throw if session already active', async () => {
      await manager.start();
      await expect(manager.start()).rejects.toThrow('Session already active');
    });

    it('should collect data points from fusion:score events', async () => {
      await manager.start();

      const score = { raw: 50, smoothed: 45, momentum: 5, level: 'focused', color: '#f0f0f0', face: null, audio: null, timestamp: Date.now() };
      eventBus.emit('fusion:score', score);

      expect(manager.currentSession.dataPoints).toHaveLength(1);
      expect(manager.currentSession.dataPoints[0]).toEqual(score);
    });

    it('should not collect data points when session is paused', async () => {
      await manager.start();
      manager.pause();

      const score = { raw: 80, smoothed: 75, momentum: 10, level: 'angry', color: '#ff0000', face: null, audio: null, timestamp: Date.now() };
      eventBus.emit('fusion:score', score);

      expect(manager.currentSession.dataPoints).toHaveLength(0);
    });
  });

  describe('pause / resume', () => {
    it('should pause active session and emit session:paused', async () => {
      await manager.start();
      const listener = vi.fn();
      eventBus.on('session:paused', listener);

      manager.pause();

      expect(manager.currentSession.status).toBe('paused');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should resume paused session and emit session:resumed', async () => {
      await manager.start();
      manager.pause();
      const listener = vi.fn();
      eventBus.on('session:resumed', listener);

      manager.resume();

      expect(manager.currentSession.status).toBe('active');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should not pause non-active session', async () => {
      await manager.start();
      manager.pause();
      manager.pause(); // should be no-op
      expect(manager.currentSession.status).toBe('paused');
    });

    it('should not resume non-paused session', async () => {
      await manager.start();
      manager.resume(); // already active, no-op
      expect(manager.currentSession.status).toBe('active');
    });
  });

  describe('stop', () => {
    it('should complete session and emit session:stopped', async () => {
      await manager.start();
      const listener = vi.fn();
      eventBus.on('session:stopped', listener);

      const completed = await manager.stop();

      expect(completed.status).toBe('completed');
      expect(completed.endedAt).toBeGreaterThan(0);
      expect(completed.stats).toBeDefined();
      expect(listener).toHaveBeenCalledOnce();
      expect(manager.currentSession).toBeNull();
    });

    it('should return null if no current session', async () => {
      const result = await manager.stop();
      expect(result).toBeNull();
    });

    it('should compute stats on stop', async () => {
      await manager.start();

      eventBus.emit('fusion:score', { smoothed: 30 });
      eventBus.emit('fusion:score', { smoothed: 85 });
      eventBus.emit('fusion:score', { smoothed: 50 });
      eventBus.emit('fusion:score', { smoothed: 90 });

      const completed = await manager.stop();

      expect(completed.stats.avg).toBeCloseTo((30 + 85 + 50 + 90) / 4, 1);
      expect(completed.stats.max).toBe(90);
      expect(completed.stats.spikes).toBe(2); // 85 and 90 ≥ 80
      expect(completed.stats.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('_computeStats', () => {
    it('should return zeros for no data points', async () => {
      await manager.start();
      const stats = manager._computeStats();
      expect(stats).toEqual({
        avg: 0,
        max: 0,
        spikes: 0,
        duration: 0,
        spikesPercent: 0,
        maxTime: null,
        histogram: Array(10).fill(0),
      });
    });

    it('should compute correct avg, max, spikes, duration', async () => {
      await manager.start();
      manager.currentSession.dataPoints = [
        { smoothed: 10 },
        { smoothed: 50 },
        { smoothed: 80 },
        { smoothed: 100 },
      ];
      // Simulate elapsed time for duration
      manager.currentSession.endedAt = manager.currentSession.startedAt + 10000;

      const stats = manager._computeStats();

      expect(stats.avg).toBe(60); // (10+50+80+100)/4
      expect(stats.max).toBe(100);
      expect(stats.spikes).toBe(2); // 80 and 100
      expect(stats.duration).toBe(10000);
    });
  });

  describe('getAllSessions', () => {
    it('should return empty array when no sessions', async () => {
      const sessions = await manager.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions sorted by startedAt', async () => {
      await manager.start();
      const s1 = { ...manager.currentSession };
      await manager.stop();

      await manager.start();
      const s2 = { ...manager.currentSession };
      await manager.stop();

      const all = await manager.getAllSessions();
      expect(all).toHaveLength(2);
      // getAllFromIndex with 'startedAt' index returns ascending by default
      expect(all[0].startedAt).toBeLessThanOrEqual(all[1].startedAt);
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      await manager.start();
      const id = manager.currentSession.id;
      await manager.stop();

      const session = await manager.getSession(id);
      expect(session).toBeTruthy();
      expect(session.id).toBe(id);
    });

    it('should return undefined for unknown id', async () => {
      const session = await manager.getSession('nonexistent');
      expect(session).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete session by id', async () => {
      await manager.start();
      const id = manager.currentSession.id;
      await manager.stop();

      await manager.deleteSession(id);

      const session = await manager.getSession(id);
      expect(session).toBeUndefined();
    });
  });

  describe('auto-save', () => {
    it('should emit session:auto-saved event', async () => {
      await manager.start();
      const listener = vi.fn();
      eventBus.on('session:auto-saved', listener);

      await manager._autoSave();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0]).toHaveProperty('id', manager.currentSession.id);
    });

    it('should update stats during auto-save', async () => {
      await manager.start();
      manager.currentSession.dataPoints = [{ smoothed: 70 }];

      await manager._autoSave();

      expect(manager.currentSession.stats.avg).toBe(70);
      expect(manager.currentSession.stats.max).toBe(70);
    });

    it('should compute numeric duration during auto-save (even with null endedAt)', async () => {
      await manager.start();
      manager.currentSession.dataPoints = [{ smoothed: 50 }];

      await manager._autoSave();

      expect(manager.currentSession.stats.duration).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(manager.currentSession.stats.duration)).toBe(false);
    });

    it('should persist session to IndexedDB on auto-save', async () => {
      await manager.start();
      const id = manager.currentSession.id;
      manager.currentSession.dataPoints = [{ smoothed: 55 }];

      await manager._autoSave();

      const persisted = await manager.getSession(id);
      expect(persisted).toBeTruthy();
      expect(persisted.dataPoints).toHaveLength(1);
    });
  });
});
