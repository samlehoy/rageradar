import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { GameProfileManager } from '../../src/modules/game-profiles.js';
import { eventBus } from '../../src/utils/event-bus.js';
import { getDB, _resetDBPromise } from '../../src/utils/db.js';

describe('GameProfileManager', () => {
  let manager;
  let db;

  beforeEach(async () => {
    eventBus.clear();
    manager = new GameProfileManager();
    await manager.init();
    db = manager._db;
  });

  afterEach(async () => {
    manager.destroy();

    if (db) {
      db.close();
    }
    _resetDBPromise();
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('rageradar');
      req.onsuccess = resolve;
      req.onerror = reject;
    });
  });

  /* ------------------------------------------------------------------ */
  /*  DB schema                                                          */
  /* ------------------------------------------------------------------ */

  it('should have gameProfiles object store after init', () => {
    expect(db.objectStoreNames.contains('gameProfiles')).toBe(true);
  });

  it('should preserve sessions and clips stores (v3 upgrade is additive)', () => {
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    expect(db.objectStoreNames.contains('clips')).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /*  createProfile                                                      */
  /* ------------------------------------------------------------------ */

  describe('createProfile', () => {
    it('should create a profile with correct fields and UUID', async () => {
      const profile = await manager.createProfile('Valorant', {
        icon: '🔫',
        color: '#ff4655',
      });

      expect(profile.id).toBeTruthy();
      expect(typeof profile.id).toBe('string');
      expect(profile.name).toBe('Valorant');
      expect(profile.icon).toBe('🔫');
      expect(profile.color).toBe('#ff4655');
      expect(profile.createdAt).toBeGreaterThan(0);
      expect(profile.updatedAt).toBe(profile.createdAt);
      expect(profile.sessionCount).toBe(0);
      expect(profile.lastPlayedAt).toBeNull();
    });

    it('should use default icon and color when not specified', async () => {
      const profile = await manager.createProfile('CS2');

      expect(profile.icon).toBe('🎮');
      expect(profile.color).toBe('#7c3aed');
    });

    it('should reject duplicate names', async () => {
      await manager.createProfile('Valorant');
      await expect(manager.createProfile('Valorant')).rejects.toThrow(
        'already exists',
      );
    });

    it('should emit profile:created event', async () => {
      const listener = vi.fn();
      eventBus.on('profile:created', listener);

      const profile = await manager.createProfile('Valorant');

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        id: profile.id,
        name: 'Valorant',
      });
    });

    it('should persist to IndexedDB', async () => {
      const profile = await manager.createProfile('Apex Legends');
      const stored = await db.get('gameProfiles', profile.id);

      expect(stored).toBeTruthy();
      expect(stored.name).toBe('Apex Legends');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getAllProfiles                                                      */
  /* ------------------------------------------------------------------ */

  describe('getAllProfiles', () => {
    it('should return profiles sorted by name', async () => {
      await manager.createProfile('Valorant');
      await manager.createProfile('Apex Legends');
      await manager.createProfile('League of Legends');

      const all = await manager.getAllProfiles();

      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Apex Legends');
      expect(all[1].name).toBe('League of Legends');
      expect(all[2].name).toBe('Valorant');
    });

    it('should return empty array when no profiles exist', async () => {
      const all = await manager.getAllProfiles();
      expect(all).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getProfile                                                         */
  /* ------------------------------------------------------------------ */

  describe('getProfile', () => {
    it('should return a single profile by id', async () => {
      const created = await manager.createProfile('Valorant');
      const fetched = await manager.getProfile(created.id);

      expect(fetched).toBeTruthy();
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe('Valorant');
    });

    it('should return undefined for unknown id', async () => {
      const result = await manager.getProfile('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  updateProfile                                                      */
  /* ------------------------------------------------------------------ */

  describe('updateProfile', () => {
    it('should partially update profile fields', async () => {
      const profile = await manager.createProfile('Valorant');

      const updated = await manager.updateProfile(profile.id, {
        icon: '🔫',
        color: '#ff4655',
      });

      expect(updated.icon).toBe('🔫');
      expect(updated.color).toBe('#ff4655');
      expect(updated.name).toBe('Valorant'); // unchanged
    });

    it('should update the updatedAt timestamp', async () => {
      const profile = await manager.createProfile('Valorant');
      const originalUpdatedAt = profile.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      const updated = await manager.updateProfile(profile.id, {
        icon: '🔫',
      });

      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should emit profile:updated event', async () => {
      const profile = await manager.createProfile('Valorant');
      const listener = vi.fn();
      eventBus.on('profile:updated', listener);

      await manager.updateProfile(profile.id, { icon: '🔫' });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        id: profile.id,
        name: 'Valorant',
      });
    });

    it('should throw for unknown profile id', async () => {
      await expect(
        manager.updateProfile('nonexistent', { name: 'X' }),
      ).rejects.toThrow('not found');
    });

    it('should persist changes to IndexedDB', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.updateProfile(profile.id, { color: '#000000' });

      const stored = await db.get('gameProfiles', profile.id);
      expect(stored.color).toBe('#000000');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteProfile                                                      */
  /* ------------------------------------------------------------------ */

  describe('deleteProfile', () => {
    it('should remove profile from store', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.deleteProfile(profile.id);

      const result = await manager.getProfile(profile.id);
      expect(result).toBeUndefined();
    });

    it('should emit profile:deleted event', async () => {
      const profile = await manager.createProfile('Valorant');
      const listener = vi.fn();
      eventBus.on('profile:deleted', listener);

      await manager.deleteProfile(profile.id);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({ id: profile.id });
    });

    it('should clear active profile if the deleted one was active', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.setActiveProfile(profile.id);

      expect(manager.getActiveProfile()).toBeTruthy();

      await manager.deleteProfile(profile.id);

      expect(manager.getActiveProfile()).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  setActiveProfile / getActiveProfile                                */
  /* ------------------------------------------------------------------ */

  describe('active profile management', () => {
    it('should track the active profile', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.setActiveProfile(profile.id);

      const active = manager.getActiveProfile();
      expect(active).toBeTruthy();
      expect(active.id).toBe(profile.id);
      expect(active.name).toBe('Valorant');
    });

    it('should emit profile:changed event with profile data', async () => {
      const profile = await manager.createProfile('Valorant', {
        icon: '🔫',
        color: '#ff4655',
      });
      const listener = vi.fn();
      eventBus.on('profile:changed', listener);

      await manager.setActiveProfile(profile.id);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        id: profile.id,
        name: 'Valorant',
        icon: '🔫',
        color: '#ff4655',
      });
    });

    it('should throw for unknown profile id', async () => {
      await expect(manager.setActiveProfile('nonexistent')).rejects.toThrow(
        'not found',
      );
    });

    it('should return null when no active profile is set', () => {
      expect(manager.getActiveProfile()).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearActiveProfile                                                 */
  /* ------------------------------------------------------------------ */

  describe('clearActiveProfile', () => {
    it('should set active profile to null and emit profile:changed', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.setActiveProfile(profile.id);

      const listener = vi.fn();
      eventBus.on('profile:changed', listener);

      manager.clearActiveProfile();

      expect(manager.getActiveProfile()).toBeNull();
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(null);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getProfileStats                                                    */
  /* ------------------------------------------------------------------ */

  describe('getProfileStats', () => {
    it('should compute stats from matching sessions', async () => {
      const profile = await manager.createProfile('Valorant');

      // Seed sessions directly into IndexedDB
      const sessions = [
        {
          id: 'sess-1',
          profileId: profile.id,
          status: 'completed',
          startedAt: 1000,
          endedAt: 2000,
          stats: { avg: 40, max: 80, duration: 1000 },
          dataPoints: [],
        },
        {
          id: 'sess-2',
          profileId: profile.id,
          status: 'completed',
          startedAt: 3000,
          endedAt: 5000,
          stats: { avg: 60, max: 95, duration: 2000 },
          dataPoints: [],
        },
        {
          id: 'sess-3',
          profileId: 'other-profile',
          status: 'completed',
          startedAt: 4000,
          endedAt: 6000,
          stats: { avg: 100, max: 100, duration: 2000 },
          dataPoints: [],
        },
      ];

      for (const s of sessions) {
        await db.put('sessions', s);
      }

      const stats = await manager.getProfileStats(profile.id);

      expect(stats.sessionCount).toBe(2);
      expect(stats.totalDuration).toBe(3000); // 1000 + 2000
      expect(stats.avgRage).toBe(50); // (40 + 60) / 2
      expect(stats.maxRage).toBe(95);
      expect(stats.lastPlayed).toBe(3000);
    });

    it('should return zeros when no matching sessions exist', async () => {
      const profile = await manager.createProfile('Valorant');
      const stats = await manager.getProfileStats(profile.id);

      expect(stats).toEqual({
        sessionCount: 0,
        totalDuration: 0,
        avgRage: 0,
        maxRage: 0,
        lastPlayed: null,
      });
    });

    it('should exclude non-completed sessions', async () => {
      const profile = await manager.createProfile('Valorant');

      await db.put('sessions', {
        id: 'sess-active',
        profileId: profile.id,
        status: 'active',
        startedAt: 1000,
        endedAt: null,
        stats: { avg: 70, max: 90, duration: 0 },
        dataPoints: [],
      });

      const stats = await manager.getProfileStats(profile.id);
      expect(stats.sessionCount).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  destroy                                                            */
  /* ------------------------------------------------------------------ */

  describe('destroy', () => {
    it('should clean up state', async () => {
      const profile = await manager.createProfile('Valorant');
      await manager.setActiveProfile(profile.id);

      manager.destroy();

      expect(manager.getActiveProfile()).toBeNull();
      expect(manager._db).toBeNull();
    });
  });
});
