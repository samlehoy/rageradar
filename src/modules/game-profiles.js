import { getDB } from '../utils/db.js';
import { eventBus } from '../utils/event-bus.js';

const STORE_NAME = 'gameProfiles';

/**
 * @typedef {Object} GameProfile
 * @property {string} id              - crypto.randomUUID()
 * @property {string} name            - e.g. 'Valorant', 'League of Legends'
 * @property {string} icon            - emoji or icon name, e.g. '🎮'
 * @property {string} color           - hex color for charts, e.g. '#7c3aed'
 * @property {number} createdAt       - timestamp
 * @property {number} updatedAt       - timestamp
 * @property {number} sessionCount    - denormalized count
 * @property {number|null} lastPlayedAt
 */

export class GameProfileManager {
  constructor() {
    this._activeProfile = null;
    this._db = null;
    this._unsubs = [];
  }

  /**
   * Initialise — open the shared DB and listen for session:stopped
   * to bump the active profile's sessionCount + lastPlayedAt.
   */
  async init() {
    this._db = await getDB();

    // When a session completes, update the active profile's denormalized stats
    const unsub = eventBus.on('session:stopped', async () => {
      if (this._activeProfile) {
        try {
          const profile = await this._getFromStore(this._activeProfile.id);
          if (profile) {
            profile.sessionCount = (profile.sessionCount || 0) + 1;
            profile.lastPlayedAt = Date.now();
            profile.updatedAt = Date.now();
            await this._putToStore(profile);
            this._activeProfile = profile;
          }
        } catch {
          // Silently ignore — non-critical bookkeeping
        }
      }
    });
    this._unsubs.push(unsub);
  }

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Create a new game profile.
   * @param {string} name
   * @param {Object} [options]
   * @param {string} [options.icon='🎮']
   * @param {string} [options.color='#7c3aed']
   * @returns {Promise<GameProfile>}
   */
  async createProfile(name, options = {}) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Profile name is required');
    }

    // Check for duplicate name (unique index will also enforce this)
    const existing = await this._getByName(name.trim());
    if (existing) {
      throw new Error(`Profile with name "${name.trim()}" already exists`);
    }

    const now = Date.now();
    const profile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon: options.icon ?? '🎮',
      color: options.color ?? '#7c3aed',
      createdAt: now,
      updatedAt: now,
      sessionCount: 0,
      lastPlayedAt: null,
    };

    await this._putToStore(profile);
    eventBus.emit('profile:created', { id: profile.id, name: profile.name });
    return profile;
  }

  /**
   * Get a single profile by ID.
   * @param {string} id
   * @returns {Promise<GameProfile|undefined>}
   */
  async getProfile(id) {
    return this._getFromStore(id);
  }

  /**
   * Get all profiles sorted alphabetically by name.
   * @returns {Promise<GameProfile[]>}
   */
  async getAllProfiles() {
    const all = await this._db.getAllFromIndex(STORE_NAME, 'name');
    return all; // Index 'name' already returns sorted
  }

  /**
   * Partially update a profile.
   * @param {string} id
   * @param {Partial<GameProfile>} updates
   * @returns {Promise<GameProfile>}
   */
  async updateProfile(id, updates) {
    const profile = await this._getFromStore(id);
    if (!profile) {
      throw new Error(`Profile "${id}" not found`);
    }

    // If name is changing, check uniqueness
    if (updates.name && updates.name.trim() !== profile.name) {
      const existing = await this._getByName(updates.name.trim());
      if (existing) {
        throw new Error(`Profile with name "${updates.name.trim()}" already exists`);
      }
    }

    // Apply allowed fields only
    const allowedFields = ['name', 'icon', 'color'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        profile[field] = typeof updates[field] === 'string' ? updates[field].trim() : updates[field];
      }
    }
    profile.updatedAt = Date.now();

    await this._putToStore(profile);
    eventBus.emit('profile:updated', { id: profile.id, name: profile.name });

    // If this is the active profile, keep in-memory copy in sync
    if (this._activeProfile?.id === id) {
      this._activeProfile = profile;
    }

    return profile;
  }

  /**
   * Delete a profile.
   * @param {string} id
   */
  async deleteProfile(id) {
    await this._db.delete(STORE_NAME, id);

    // Clear active if it was the deleted profile
    if (this._activeProfile?.id === id) {
      this._activeProfile = null;
      eventBus.emit('profile:changed', null);
    }

    eventBus.emit('profile:deleted', { id });
  }

  /* ------------------------------------------------------------------ */
  /*  Active profile management                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Set the active game profile.
   * @param {string} id
   */
  async setActiveProfile(id) {
    const profile = await this._getFromStore(id);
    if (!profile) {
      throw new Error(`Profile "${id}" not found`);
    }

    this._activeProfile = profile;
    eventBus.emit('profile:changed', {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
      color: profile.color,
    });
  }

  /**
   * Get the currently active profile (in-memory).
   * @returns {GameProfile|null}
   */
  getActiveProfile() {
    return this._activeProfile;
  }

  /**
   * Clear the active profile.
   */
  clearActiveProfile() {
    this._activeProfile = null;
    eventBus.emit('profile:changed', null);
  }

  /* ------------------------------------------------------------------ */
  /*  Profile stats                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Compute aggregate stats from sessions linked to this profile.
   * @param {string} profileId
   * @returns {Promise<Object>}
   */
  async getProfileStats(profileId) {
    const allSessions = await this._db.getAllFromIndex('sessions', 'startedAt');
    const profileSessions = allSessions.filter(
      (s) => s.profileId === profileId && s.status === 'completed',
    );

    if (profileSessions.length === 0) {
      return {
        sessionCount: 0,
        totalDuration: 0,
        avgRage: 0,
        maxRage: 0,
        lastPlayed: null,
      };
    }

    return {
      sessionCount: profileSessions.length,
      totalDuration: profileSessions.reduce(
        (sum, s) => sum + (s.stats?.duration || 0),
        0,
      ),
      avgRage:
        profileSessions.reduce((sum, s) => sum + (s.stats?.avg || 0), 0) /
        profileSessions.length,
      maxRage: Math.max(...profileSessions.map((s) => s.stats?.max || 0)),
      lastPlayed: Math.max(...profileSessions.map((s) => s.startedAt)),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Unsubscribe all listeners and clear state.
   */
  destroy() {
    this._unsubs.forEach((unsub) => unsub());
    this._unsubs = [];
    this._activeProfile = null;
    this._db = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** @private */
  async _getFromStore(id) {
    return this._db.get(STORE_NAME, id);
  }

  /** @private */
  async _putToStore(profile) {
    await this._db.put(STORE_NAME, profile);
  }

  /** @private */
  async _getByName(name) {
    return this._db.getFromIndex(STORE_NAME, 'name', name);
  }
}
