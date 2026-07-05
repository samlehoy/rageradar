import { describe, it, expect } from 'vitest';
import { RAGE_LEVELS, getRageLevel, getRageColor, scoreToAngle } from '../../src/utils/rage-levels.js';

describe('Rage Levels', () => {
  it('should have 5 levels', () => {
    expect(RAGE_LEVELS).toHaveLength(5);
  });

  describe('getRageLevel boundaries', () => {
    it('should return calm for scores 0-20', () => {
      expect(getRageLevel(0).name).toBe('calm');
      expect(getRageLevel(10).name).toBe('calm');
      expect(getRageLevel(20).name).toBe('calm');
    });

    it('should return focused for scores 21-40', () => {
      expect(getRageLevel(21).name).toBe('focused');
      expect(getRageLevel(30).name).toBe('focused');
      expect(getRageLevel(40).name).toBe('focused');
    });

    it('should return tense for scores 41-60', () => {
      expect(getRageLevel(41).name).toBe('tense');
      expect(getRageLevel(50).name).toBe('tense');
      expect(getRageLevel(60).name).toBe('tense');
    });

    it('should return angry for scores 61-80', () => {
      expect(getRageLevel(61).name).toBe('angry');
      expect(getRageLevel(70).name).toBe('angry');
      expect(getRageLevel(80).name).toBe('angry');
    });

    it('should return rage for scores 81-100', () => {
      expect(getRageLevel(81).name).toBe('rage');
      expect(getRageLevel(90).name).toBe('rage');
      expect(getRageLevel(100).name).toBe('rage');
    });
  });

  it('getRageLevel should clamp out-of-range scores', () => {
    expect(getRageLevel(-5).name).toBe('calm');
    expect(getRageLevel(200).name).toBe('rage');
  });

  describe('getRageColor for all 5 levels', () => {
    it('should return green for calm', () => {
      expect(getRageColor(0)).toBe('#22c55e');
      expect(getRageColor(20)).toBe('#22c55e');
    });

    it('should return lime for focused', () => {
      expect(getRageColor(21)).toBe('#84cc16');
      expect(getRageColor(40)).toBe('#84cc16');
    });

    it('should return yellow for tense', () => {
      expect(getRageColor(41)).toBe('#eab308');
      expect(getRageColor(60)).toBe('#eab308');
    });

    it('should return orange for angry', () => {
      expect(getRageColor(61)).toBe('#f97316');
      expect(getRageColor(80)).toBe('#f97316');
    });

    it('should return red for rage', () => {
      expect(getRageColor(81)).toBe('#ef4444');
      expect(getRageColor(100)).toBe('#ef4444');
    });
  });

  describe('scoreToAngle', () => {
    it('should map 0-100 to 135-405', () => {
      expect(scoreToAngle(0)).toBe(135);
      expect(scoreToAngle(100)).toBe(405);
      expect(scoreToAngle(50)).toBe(270);
    });

    it('should clamp negative scores to 135 degrees', () => {
      expect(scoreToAngle(-10)).toBe(135);
      expect(scoreToAngle(-1)).toBe(135);
    });

    it('should clamp scores above 100 to 405 degrees', () => {
      expect(scoreToAngle(150)).toBe(405);
      expect(scoreToAngle(200)).toBe(405);
    });

    it('should map intermediate values linearly', () => {
      expect(scoreToAngle(25)).toBe(202.5);  // 135 + (25/100)*270
      expect(scoreToAngle(75)).toBe(337.5);  // 135 + (75/100)*270
    });
  });
});
