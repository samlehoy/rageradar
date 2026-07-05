import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FusionEngine } from '../../src/modules/fusion.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock helper: create an EmotionSnapshot
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

// Mock helper: create an AudioSnapshot
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

describe('FusionEngine', () => {
  let engine;

  beforeEach(() => {
    eventBus.clear();
    engine = new FusionEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('calculateFaceScore', () => {
    it('should return low score for neutral face', () => {
      const face = makeFace({ neutral: 1.0 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeLessThan(20);
    });

    it('should return high score for angry face', () => {
      const face = makeFace({ angry: 0.9, neutral: 0.1 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeGreaterThan(50);
    });

    it('should return low score for happy face', () => {
      const face = makeFace({ happy: 0.9, neutral: 0.1 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeLessThan(10);
    });

    it('should return 0 for null face', () => {
      expect(engine.calculateFaceScore(null)).toBe(0);
    });

    it('should handle mixed expressions', () => {
      const face = makeFace({ angry: 0.5, disgusted: 0.3, neutral: 0.2 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeGreaterThan(30);
      expect(score).toBeLessThan(80);
    });
  });

  describe('calculateAudioScore', () => {
    it('should return 0 for silence', () => {
      const audio = makeAudio({ isSpeaking: false });
      expect(engine.calculateAudioScore(audio)).toBe(0);
    });

    it('should return higher score for loud speech', () => {
      const quiet = makeAudio({ volumeRMS: 0.1, isSpeaking: true, pitchHz: 150 });
      const loud = makeAudio({ volumeRMS: 0.8, isSpeaking: true, pitchHz: 150 });
      expect(engine.calculateAudioScore(loud)).toBeGreaterThan(engine.calculateAudioScore(quiet));
    });

    it('should return higher score for high pitch', () => {
      const lowPitch = makeAudio({ volumeRMS: 0.3, isSpeaking: true, pitchHz: 120 });
      const highPitch = makeAudio({ volumeRMS: 0.3, isSpeaking: true, pitchHz: 400 });
      expect(engine.calculateAudioScore(highPitch)).toBeGreaterThan(engine.calculateAudioScore(lowPitch));
    });

    it('should return 0 for null audio', () => {
      expect(engine.calculateAudioScore(null)).toBe(0);
    });
  });

  describe('applyEMA', () => {
    it('should smooth rapid changes', () => {
      engine.applyEMA(0); // Initialize
      const result1 = engine.applyEMA(100); // Sudden spike
      expect(result1).toBeLessThan(100); // Should be smoothed
      expect(result1).toBeGreaterThan(0);
    });

    it('should converge to stable input over time', () => {
      let smoothed = 0;
      for (let i = 0; i < 50; i++) {
        smoothed = engine.applyEMA(75);
      }
      expect(smoothed).toBeCloseTo(75, 0); // Should converge
    });
  });

  describe('applyHysteresis', () => {
    it('should not change level immediately at boundary', () => {
      engine._currentLevel = 'calm';
      const level = engine.applyHysteresis(25); // Just into 'focused' zone
      expect(level).toBe('calm'); // Should stay
    });

    it('should change level after hysteresis timeout', () => {
      engine._currentLevel = 'calm';
      engine._pendingLevel = 'focused';
      engine._pendingLevelSince = Date.now() - 3000; // 3s ago (> 2s threshold)
      const level = engine.applyHysteresis(30);
      expect(level).toBe('focused');
    });
  });

  describe('calculateRawScore', () => {
    it('should combine face and audio with configured weights', () => {
      engine._lastFace = makeFace({ angry: 0.8, neutral: 0.2 });
      engine._lastAudio = makeAudio({ volumeRMS: 0.5, isSpeaking: true, pitchHz: 300 });
      const score = engine.calculateRawScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should work with face only (no audio)', () => {
      engine._lastFace = makeFace({ angry: 0.9 });
      engine._lastAudio = null;
      const score = engine.calculateRawScore();
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      engine._smoothedScore = 50;
      engine._momentum = 10;
      engine._currentLevel = 'angry';
      engine.reset();
      expect(engine._smoothedScore).toBe(0);
      expect(engine._momentum).toBe(0);
      expect(engine._currentLevel).toBe('calm');
    });
  });

  describe('event integration', () => {
    it('should emit fusion:score on camera:expression event', () => {
      const listener = vi.fn();
      eventBus.on('fusion:score', listener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.5 }));

      expect(listener).toHaveBeenCalledOnce();
      const score = listener.mock.calls[0][0];
      expect(score).toHaveProperty('raw');
      expect(score).toHaveProperty('smoothed');
      expect(score).toHaveProperty('momentum');
      expect(score).toHaveProperty('level');
      expect(score).toHaveProperty('color');
    });
  });
});
