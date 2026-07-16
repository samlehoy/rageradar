import { openDB } from 'idb';

export const DB_NAME = 'rageradar';
export const DB_VERSION = 3;

let dbPromise = null;

/**
 * Returns a singleton promise that resolves to the shared IDB database.
 * All modules should use this instead of calling openDB directly,
 * so the upgrade logic lives in a single place.
 */
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1: sessions store
        if (oldVersion < 1) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('startedAt', 'startedAt');
          sessions.createIndex('status', 'status');
        }
        // v2: clips store
        if (oldVersion < 2) {
          const clips = db.createObjectStore('clips', { keyPath: 'id' });
          clips.createIndex('sessionId', 'sessionId');
          clips.createIndex('timestamp', 'timestamp');
        }
        // v3: gameProfiles store
        if (oldVersion < 3) {
          const profiles = db.createObjectStore('gameProfiles', { keyPath: 'id' });
          profiles.createIndex('name', 'name', { unique: true });
          profiles.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Reset the cached promise. Useful in tests to get a fresh DB connection
 * after deleting the database between runs.
 */
export function _resetDBPromise() {
  dbPromise = null;
}
