import { describe, it, expect } from 'vitest';
import { RAGE_LEVELS, getRageLevel, getRageColor, scoreToAngle } from '../../src/utils/rage-levels.js';

describe('Rage Levels', () => {
  it('should have 5 levels', () => {
    expect(RAGE_LEVELS).toHaveLength(5);
  });

  it('getRageLevel should return calm for low scores', () => {
    expect(getRageLevel(0).name).toBe('calm');
    expect(getRageLevel(10).name).toBe('calm');
    expect(getRageLevel(20).name).toBe('calm');
  });

  it('getRageLevel should return rage for high scores', () => {
    expect(getRageLevel(81).name).toBe('rage');
    expect(getRageLevel(100).name).toBe('rage');
  });

  it('getRageLevel should clamp out-of-range scores', () => {
    expect(getRageLevel(-5).name).toBe('calm');
    expect(getRageLevel(200).name).toBe('rage');
  });

  it('getRageColor should return correct hex', () => {
    expect(getRageColor(10)).toBe('#22c55e');
    expect(getRageColor(90)).toBe('#ef4444');
  });

  it('scoreToAngle should map 0-100 to 135-405', () => {
    expect(scoreToAngle(0)).toBe(135);
    expect(scoreToAngle(100)).toBe(405);
    expect(scoreToAngle(50)).toBe(270);
  });
});
