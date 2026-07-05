import { openDB } from 'idb';
import { eventBus } from '../utils/event-bus.js';

const DB_NAME = 'rageradar';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SAVE_INTERVAL_MS = 5000; // Auto-save every 5 seconds

/**
 * @typedef {Object} SessionData
 * @property {string} id - UUID
 * @property {number} startedAt - Unix timestamp
 * @property {number|null} endedAt - Unix timestamp or null if active
 * @property {string} status - 'active' | 'paused' | 'completed'
 * @property {Array<RageScore>} dataPoints - Collected rage scores
 * @property {Object} stats - Computed statistics
 */

export class SessionManager {
  constructor() {
    this.db = null;
    this.currentSession = null;
    this._saveIntervalId = null;
    this._unsub = null;
  }

  async init() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt');
          store.createIndex('status', 'status');
        }
      },
    });
  }

  /**
   * Start a new session.
   * @returns {SessionData}
   */
  async start() {
    if (this.currentSession?.status === 'active') {
      throw new Error('Session already active');
    }

    this.currentSession = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      endedAt: null,
      status: 'active',
      dataPoints: [],
      stats: { avg: 0, max: 0, spikes: 0, duration: 0 },
    };

    // Subscribe to rage score events
    this._unsub = eventBus.on('fusion:score', (score) => {
      if (this.currentSession?.status === 'active') {
        this.currentSession.dataPoints.push(score);
      }
    });

    // Start auto-save
    this._saveIntervalId = setInterval(() => this._autoSave(), SAVE_INTERVAL_MS);

    await this._save();
    eventBus.emit('session:started', { id: this.currentSession.id });
    return this.currentSession;
  }

  /**
   * Pause the current session.
   */
  pause() {
    if (!this.currentSession || this.currentSession.status !== 'active') return;
    this.currentSession.status = 'paused';
    eventBus.emit('session:paused', { id: this.currentSession.id });
  }

  /**
   * Resume a paused session.
   */
  resume() {
    if (!this.currentSession || this.currentSession.status !== 'paused') return;
    this.currentSession.status = 'active';
    eventBus.emit('session:resumed', { id: this.currentSession.id });
  }

  /**
   * Stop and finalize the current session.
   * @returns {SessionData}
   */
  async stop() {
    if (!this.currentSession) return null;

    this.currentSession.status = 'completed';
    this.currentSession.endedAt = Date.now();
    this.currentSession.stats = this._computeStats();

    // Clean up
    this._unsub?.();
    if (this._saveIntervalId) {
      clearInterval(this._saveIntervalId);
      this._saveIntervalId = null;
    }

    await this._save();
    eventBus.emit('session:stopped', {
      id: this.currentSession.id,
      stats: this.currentSession.stats,
    });

    const completed = { ...this.currentSession };
    this.currentSession = null;
    return completed;
  }

  /**
   * Get all past sessions.
   * @returns {Promise<SessionData[]>}
   */
  async getAllSessions() {
    return this.db.getAllFromIndex(STORE_NAME, 'startedAt');
  }

  /**
   * Get a single session by ID.
   * @param {string} id
   * @returns {Promise<SessionData>}
   */
  async getSession(id) {
    return this.db.get(STORE_NAME, id);
  }

  /**
   * Delete a session.
   * @param {string} id
   */
  async deleteSession(id) {
    await this.db.delete(STORE_NAME, id);
  }

  /** @private */
  _computeStats() {
    const points = this.currentSession.dataPoints;
    if (points.length === 0) return { avg: 0, max: 0, spikes: 0, duration: 0, spikesPercent: 0, maxTime: null, histogram: Array(10).fill(0) };

    const scores = points.map(p => p.smoothed);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const spikes = scores.filter(s => s >= 80).length;
    const duration = (this.currentSession.endedAt ?? Date.now()) - this.currentSession.startedAt;

    let maxTime = null;
    let maxVal = -1;
    points.forEach(p => {
      if (p.smoothed > maxVal) {
        maxVal = p.smoothed;
        maxTime = p.timestamp;
      }
    });

    const histogram = Array(10).fill(0);
    points.forEach(p => {
      const bin = Math.min(9, Math.floor(p.smoothed / 10));
      histogram[bin]++;
    });

    return {
      avg: Math.round(avg * 10) / 10,
      max: Math.round(max * 10) / 10,
      spikes,
      duration,
      spikesPercent: Math.round((spikes / scores.length) * 100),
      maxTime,
      histogram,
    };
  }

  /** @private */
  async _save() {
    if (this.currentSession && this.db) {
      await this.db.put(STORE_NAME, this.currentSession);
    }
  }

  /** @private */
  async _autoSave() {
    if (this.currentSession) {
      this.currentSession.stats = this._computeStats();
      await this._save();
      eventBus.emit('session:auto-saved', { id: this.currentSession.id });
    }
  }
}
