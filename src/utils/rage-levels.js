/**
 * Rage scale constants and helper functions.
 */
export const RAGE_LEVELS = [
  { name: 'calm',    min: 0,  max: 20, color: '#22c55e', glow: 'rgba(34,197,94,0.4)',   pulseDuration: '2s',   emoji: '🟢' },
  { name: 'focused', min: 21, max: 40, color: '#84cc16', glow: 'rgba(132,204,22,0.4)',  pulseDuration: '1.5s', emoji: '🟡' },
  { name: 'tense',   min: 41, max: 60, color: '#eab308', glow: 'rgba(234,179,8,0.4)',   pulseDuration: '1.2s', emoji: '🟠' },
  { name: 'angry',   min: 61, max: 80, color: '#f97316', glow: 'rgba(249,115,22,0.5)',  pulseDuration: '0.8s', emoji: '🔴' },
  { name: 'rage',    min: 81, max: 100, color: '#ef4444', glow: 'rgba(239,68,68,0.6)',   pulseDuration: '0.5s', emoji: '🔴' },
];

/**
 * Get rage level object for a given score.
 * @param {number} score - Rage score 0-100
 * @returns {Object} Rage level { name, min, max, color, glow, pulseDuration, emoji }
 */
export function getRageLevel(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return RAGE_LEVELS.find(l => clamped >= l.min && clamped <= l.max) || RAGE_LEVELS[0];
}

/**
 * Get interpolated color for a score (for Chart.js gradient).
 * @param {number} score - Rage score 0-100
 * @returns {string} Hex color
 */
export function getRageColor(score) {
  return getRageLevel(score).color;
}

/**
 * Map score to needle angle (135° to 405° for 270° arc).
 * @param {number} score - Rage score 0-100
 * @returns {number} Angle in degrees
 */
export function scoreToAngle(score) {
  const clamped = Math.max(0, Math.min(100, score));
  return 135 + (clamped / 100) * 270;
}
