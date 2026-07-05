/**
 * Integration tests for RageRadar end-to-end event flow.
 * Tests the interaction between modules through the shared event bus
 * without requiring real camera/mic hardware.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { FusionEngine } from '../../src/modules/fusion.js';
import { SessionManager } from '../../src/modules/session.js';
import { AlertSystem } from '../../src/modules/alerts.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Helper: create an EmotionSnapshot
function makeFace(overrides = {}) {
  return {
    timestamp: Date.now(),
    expressions: {
      angry: 0, disgusted: 0, fearful: 0,
      happy: 0, neutral: 1, sad: 0, surprised: 0,
      ...overrides,
    },
    dominant: 'neutral',
    confidence: 1.0,
  };
}

// Helper: create an AudioSnapshot
function makeAudio(overrides = {}) {
  return {
    timestamp: Date.now(),
    volumeRMS: 0.0,
    volumeDB: -100,
    pitchHz: 0,
    spectralCentroid: 0,
    isSpeaking: false,
    ...overrides,
  };
}

// Config that makes face score = raw score (no weighting dilution, no smoothing)
const DIRECT_SCORE_CONFIG = {
  faceWeight: 1.0,
  audioWeight: 0.0,
  emaAlpha: 1.0,
};

describe('App Event Flow Integration', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  describe('Flow 1: camera:expression -> fusion:score', () => {
    let engine;

    beforeEach(() => {
      engine = new FusionEngine();
    });

    afterEach(() => {
      engine.destroy();
    });

    it('should emit fusion:score when a face expression event arrives', () => {
      const scoreListener = vi.fn();
      eventBus.on('fusion:score', scoreListener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.7, neutral: 0.3 }));

      expect(scoreListener).toHaveBeenCalledOnce();
      const result = scoreListener.mock.calls[0][0];
      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('smoothed');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('color');
      expect(typeof result.raw).toBe('number');
      expect(result.raw).toBeGreaterThan(0);
      expect(result.raw).toBeLessThanOrEqual(100);
    });
  });

  describe('Flow 2: mic:audio buffered, combined on next face', () => {
    let engine;

    beforeEach(() => {
      engine = new FusionEngine();
    });

    afterEach(() => {
      engine.destroy();
    });

    it('should buffer audio and fuse it with the next face expression', () => {
      const scoreListener = vi.fn();
      eventBus.on('fusion:score', scoreListener);

      // Send audio first (should not trigger score)
      eventBus.emit('mic:audio', makeAudio({
        volumeRMS: 0.8, isSpeaking: true, pitchHz: 400, spectralCentroid: 3000,
      }));

      // Audio alone should not trigger fusion:score
      expect(scoreListener).not.toHaveBeenCalled();
      expect(engine._lastAudio).not.toBeNull();

      // Now send face expression -- should trigger fusion with buffered audio
      eventBus.emit('camera:expression', makeFace({ angry: 0.6, neutral: 0.4 }));

      expect(scoreListener).toHaveBeenCalledOnce();
      const result = scoreListener.mock.calls[0][0];
      // Score should reflect both face and audio contributions
      expect(result.raw).toBeGreaterThan(0);
      expect(result.face).not.toBeNull();
      expect(result.audio).not.toBeNull();
      expect(result.audio.volumeRMS).toBe(0.8);
    });

    it('should use the most recent audio data when multiple audio events arrive', () => {
      const scoreListener = vi.fn();
      eventBus.on('fusion:score', scoreListener);

      // Send quiet audio first
      eventBus.emit('mic:audio', makeAudio({
        volumeRMS: 0.1, isSpeaking: true, pitchHz: 120,
      }));

      // Then send loud audio -- should overwrite
      eventBus.emit('mic:audio', makeAudio({
        volumeRMS: 0.9, isSpeaking: true, pitchHz: 500, spectralCentroid: 3500,
      }));

      // Trigger fusion with face
      eventBus.emit('camera:expression', makeFace({ angry: 0.5, neutral: 0.5 }));

      expect(scoreListener).toHaveBeenCalledOnce();
      const result = scoreListener.mock.calls[0][0];
      // Should use the latest (loud) audio
      expect(result.audio.volumeRMS).toBe(0.9);
      expect(result.audio.pitchHz).toBe(500);
    });
  });

  describe('Flow 3: fusion:score above threshold -> alert:triggered', () => {
    let engine;
    let alertSystem;

    beforeEach(() => {
      // FaceWeight=1.0 so raw score = face score directly
      engine = new FusionEngine(DIRECT_SCORE_CONFIG);
      alertSystem = new AlertSystem({ threshold: 50, cooldownMs: 5000, soundEnabled: false });
    });

    afterEach(() => {
      engine.destroy();
      alertSystem.destroy();
    });

    it('should emit alert:triggered when score exceeds threshold', () => {
      const alertListener = vi.fn();
      eventBus.on('alert:triggered', alertListener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));
      // Face score = 58, raw = 58 * 1.0 = 58, smoothed = 58 with emaAlpha=1.0
      // 58 > 50 => alert fires

      expect(alertListener).toHaveBeenCalledOnce();
      const alert = alertListener.mock.calls[0][0];
      expect(alert).toHaveProperty('score');
      expect(alert).toHaveProperty('level');
      expect(alert).toHaveProperty('color');
      expect(alert).toHaveProperty('emoji');
      expect(alert).toHaveProperty('timestamp');
      expect(alert).toHaveProperty('message');
      expect(alert.score).toBeGreaterThanOrEqual(50);
    });

    it('should NOT emit alert:triggered for scores below threshold', () => {
      const alertListener = vi.fn();
      eventBus.on('alert:triggered', alertListener);

      eventBus.emit('camera:expression', makeFace({ neutral: 1.0 }));

      expect(alertListener).not.toHaveBeenCalled();
    });

    it('should respect cooldown period between alerts', () => {
      const alertListener = vi.fn();
      eventBus.on('alert:triggered', alertListener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));
      expect(alertListener).toHaveBeenCalledTimes(1);

      // Second alert-triggering expression immediately after -- blocked by cooldown
      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));
      expect(alertListener).toHaveBeenCalledTimes(1);
    });

    it('should set correct alert message based on score above threshold', () => {
      const alertListener = vi.fn();
      eventBus.on('alert:triggered', alertListener);

      // angry=0.85 => face score = (0.85*1.0 + 0.15*(-0.3)) / 1.5 * 100 = 53.67
      // score ≥ 50 => alert fires. Level reports as 'calm' on first frame due to hysteresis
      eventBus.emit('camera:expression', makeFace({ angry: 0.85, neutral: 0.15 }));

      expect(alertListener).toHaveBeenCalled();
      const alert = alertListener.mock.calls[0][0];
      expect(alert.score).toBeGreaterThanOrEqual(50);
      expect(alert.message).toBeTruthy();
    });

    it('should not alert when alert system is disabled', () => {
      alertSystem.updateConfig({ enabled: false });

      const alertListener = vi.fn();
      eventBus.on('alert:triggered', alertListener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));

      expect(alertListener).not.toHaveBeenCalled();
    });
  });

  describe('Flow 4: Session data collection from fusion:score', () => {
    let engine;
    let manager;

    beforeEach(async () => {
      engine = new FusionEngine(DIRECT_SCORE_CONFIG);
      manager = new SessionManager();
      await manager.init();
    });

    afterEach(async () => {
      engine.destroy();
      if (manager.currentSession) {
        await manager.stop();
      }
      manager._unsub?.();
      if (manager._saveIntervalId) {
        clearInterval(manager._saveIntervalId);
        manager._saveIntervalId = null;
      }
      manager.currentSession = null;
      if (manager.db) {
        manager.db.close();
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase('rageradar');
          req.onsuccess = resolve;
          req.onerror = reject;
        });
      }
    });

    it('should collect data points when session is active', async () => {
      await manager.start();
      expect(manager.currentSession.dataPoints).toHaveLength(0);

      eventBus.emit('camera:expression', makeFace({ angry: 0.5, neutral: 0.5 }));

      expect(manager.currentSession.dataPoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should compute stats from collected data points on stop', async () => {
      await manager.start();

      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));
      eventBus.emit('camera:expression', makeFace({ angry: 0.6, neutral: 0.4 }));
      eventBus.emit('camera:expression', makeFace({ angry: 0.3, neutral: 0.7 }));
      eventBus.emit('camera:expression', makeFace({ angry: 0.95, neutral: 0.05 }));

      const completed = await manager.stop();

      // Data points should have been collected before stop
      expect(completed.dataPoints.length).toBeGreaterThanOrEqual(1);

      // Each data point should have a valid smoothed value
      const allHaveSmoothed = completed.dataPoints.every(p => typeof p.smoothed === 'number');
      expect(allHaveSmoothed).toBe(true);

      const smoothedValues = completed.dataPoints.map(p => p.smoothed);
      const maxSmoothed = Math.max(...smoothedValues);
      expect(maxSmoothed).toBeGreaterThan(0);

      // Stats should reflect actual data
      expect(completed.stats.avg).toBeGreaterThan(0);
      expect(completed.stats.max).toBe(maxSmoothed);
      expect(completed.stats.duration).toBeGreaterThanOrEqual(0);
    });

    it('should stop collecting after session is stopped', async () => {
      await manager.start();

      eventBus.emit('camera:expression', makeFace({ angry: 0.5, neutral: 0.5 }));
      expect(manager.currentSession.dataPoints.length).toBeGreaterThanOrEqual(1);

      await manager.stop();
      expect(manager.currentSession).toBeNull();
    });

    it('should not collect data points when session is paused', async () => {
      await manager.start();
      manager.pause();

      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));

      expect(manager.currentSession.dataPoints).toHaveLength(0);
    });
  });

  describe('Flow 5: Full event chain verification', () => {
    let engine;
    let alertSystem;
    let manager;

    beforeEach(async () => {
      engine = new FusionEngine(DIRECT_SCORE_CONFIG);
      alertSystem = new AlertSystem({ threshold: 50, cooldownMs: 5000, soundEnabled: false });
      manager = new SessionManager();
      await manager.init();
    });

    afterEach(async () => {
      engine.destroy();
      alertSystem.destroy();
      if (manager.currentSession) {
        await manager.stop();
      }
      manager._unsub?.();
      if (manager._saveIntervalId) {
        clearInterval(manager._saveIntervalId);
        manager._saveIntervalId = null;
      }
      manager.currentSession = null;
      if (manager.db) {
        manager.db.close();
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase('rageradar');
          req.onsuccess = resolve;
          req.onerror = reject;
        });
      }
    });

    it('should chain camera:expression -> fusion:score -> alert:triggered', () => {
      const scoreListener = vi.fn();
      const alertListener = vi.fn();
      eventBus.on('fusion:score', scoreListener);
      eventBus.on('alert:triggered', alertListener);

      // Neutral face -> low score, no alert
      eventBus.emit('camera:expression', makeFace({ neutral: 1.0 }));
      expect(scoreListener).toHaveBeenCalled();
      expect(alertListener).not.toHaveBeenCalled();

      // Angry face -> high score, alert should fire
      eventBus.emit('camera:expression', makeFace({ angry: 0.9, neutral: 0.1 }));
      expect(alertListener).toHaveBeenCalledOnce();
      const alert = alertListener.mock.calls[0][0];
      // smoke test: alert contains expected fields
      expect(typeof alert.score).toBe('number');
      expect(alert.level).toBeTruthy();
      expect(alert.message).toBeTruthy();
      expect(alert.score).toBeGreaterThanOrEqual(50);
    });

    it('should chain mic:audio + camera:expression -> fusion:score -> session -> alert', async () => {
      // Use default engine weights to test audio integration
      engine.destroy();
      engine = new FusionEngine({ emaAlpha: 1.0 }); // default weights, no smoothing
      engine._lastFace = null;
      engine._lastAudio = null;

      await manager.start();

      const scoreListener = vi.fn();
      const alertListener = vi.fn();
      eventBus.on('fusion:score', scoreListener);
      eventBus.on('alert:triggered', alertListener);

      // Send loud audio + angry face = combined score above alert threshold
      eventBus.emit('mic:audio', makeAudio({
        volumeRMS: 0.9, isSpeaking: true, pitchHz: 450, spectralCentroid: 3500,
      }));

      expect(scoreListener).not.toHaveBeenCalled();
      expect(alertListener).not.toHaveBeenCalled();

      // Send angry face to trigger fusion
      eventBus.emit('camera:expression', makeFace({ angry: 0.95, neutral: 0.05 }));

      expect(scoreListener).toHaveBeenCalledOnce();
      const score = scoreListener.mock.calls[0][0];
      expect(score.raw).toBeGreaterThan(0);

      // Session should have collected the data point
      const collectedPoints = manager.currentSession.dataPoints;
      expect(collectedPoints.length).toBeGreaterThanOrEqual(1);

      // With angry=0.95 face and loud audio, the combined weighted score should
      // be well above the alert threshold of 50
      expect(alertListener).toHaveBeenCalled();
      const alert = alertListener.mock.calls[0][0];
      expect(alert.score).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Edge: FusionEngine constructor with custom config', () => {
    it('should accept custom config and use it for scoring', () => {
      const customEngine = new FusionEngine({ faceWeight: 1.0, audioWeight: 0.0, emaAlpha: 1.0 });
      customEngine._lastFace = makeFace({ angry: 1.0 });
      customEngine._lastAudio = makeAudio({ volumeRMS: 0.8, isSpeaking: true });

      const raw = customEngine.calculateRawScore();
      const faceScore = customEngine.calculateFaceScore(customEngine._lastFace);
      expect(raw).toBe(faceScore);

      customEngine.destroy();
    });
  });
});
