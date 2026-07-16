import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSettings, saveSettings, resetSettings,
  DEFAULT_SETTINGS, STORAGE_KEY, deepMerge,
} from '../../src/utils/settings-store.js';

/**
 * Node 22+ ships a native `localStorage` that lacks the full Web Storage API
 * (no getItem, setItem, removeItem, clear). Vitest's jsdom environment no
 * longer overrides it. We install a spec-compliant shim on `globalThis` so
 * that both the source module and these tests use the same mock store.
 */
const store = new Map();

const localStorageMock = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (index) => [...store.keys()][index] ?? null,
};

// Replace the broken native localStorage before the module under test runs.
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

describe('settings-store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadSettings', () => {
    it('should return defaults when nothing is stored', () => {
      const settings = loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should deep-merge stored overrides with defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        alerts: { threshold: 90 },
      }));

      const settings = loadSettings();
      expect(settings.alerts.threshold).toBe(90);
      expect(settings.alerts.enabled).toBe(true); // default preserved
      expect(settings.camera.detectionFps).toBe(10); // other sections untouched
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json!!!');

      // loadSettings should swallow the parse error and fall back to defaults
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const settings = loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
      consoleSpy.mockRestore();
    });
  });

  describe('saveSettings', () => {
    it('should persist settings to localStorage', () => {
      const custom = { ...DEFAULT_SETTINGS, alerts: { ...DEFAULT_SETTINGS.alerts, threshold: 42 } };
      saveSettings(custom);

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.alerts.threshold).toBe(42);
    });
  });

  describe('resetSettings', () => {
    it('should remove stored settings and return defaults', () => {
      saveSettings({ alerts: { threshold: 99 } });
      const fresh = resetSettings();

      expect(fresh).toEqual(DEFAULT_SETTINGS);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('deepMerge', () => {
    it('should not mutate source or target', () => {
      const target = { a: { b: 1 } };
      const source = { a: { c: 2 } };
      const result = deepMerge(target, source);

      expect(target).toEqual({ a: { b: 1 } });
      expect(source).toEqual({ a: { c: 2 } });
      expect(result).toEqual({ a: { b: 1, c: 2 } });
    });

    it('should handle arrays as leaf values (no deep merge)', () => {
      const target = { arr: [1, 2] };
      const source = { arr: [3, 4, 5] };
      const result = deepMerge(target, source);
      expect(result.arr).toEqual([3, 4, 5]);
    });
  });
});
