/**
 * Rage Meter — SVG radial gauge component.
 * 270° arc with animated needle, tick marks, and score overlay.
 * Subscribes to fusion:score events from the FusionEngine.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel, scoreToAngle } from '../utils/rage-levels.js';

// ─── Constants ───────────────────────────────────────────────
const CX = 120;
const CY = 120;
const R = 100;
const ARC_START = 135;
const ARC_END = 405;
const ARC_LENGTH = 270;
const TICK_COUNT = 10;

// ─── Geometry helpers ────────────────────────────────────────

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function arcPoint(deg, radius) {
  return {
    x: CX + radius * Math.cos(degToRad(deg)),
    y: CY + radius * Math.sin(degToRad(deg)),
  };
}

function arcPath(startDeg, endDeg, radius) {
  const start = arcPoint(startDeg, radius);
  const end = arcPoint(endDeg, radius);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function circumference(radius) {
  return 2 * Math.PI * radius;
}

// ─── SVG builders ────────────────────────────────────────────

function renderTicks() {
  const parts = [];
  for (let i = 0; i <= TICK_COUNT; i++) {
    const angle = ARC_START + (i / TICK_COUNT) * ARC_LENGTH;
    const isMain = i === 0 || i === 5 || i === 10;
    const innerR = isMain ? 88 : 92;
    const outerR = 100;
    const inner = arcPoint(angle, innerR);
    const outer = arcPoint(angle, outerR);
    const cls = isMain ? 'tick-main' : 'tick-minor';
    parts.push(
      `<line class="${cls}" x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" />`
    );
  }
  return parts.join('\n    ');
}

function renderSVG() {
  const trackPath = arcPath(ARC_START, ARC_END, R);
  const arcLen = circumference(R) * (ARC_LENGTH / 360);

  return [
    `<svg class="rage-meter-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Calm - 0%">`,
    `  <defs>`,
    `    <filter id="rage-glow" x="-50%" y="-50%" width="200%" height="200%">`,
    `      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />`,
    `      <feMerge>`,
    `        <feMergeNode in="blur" />`,
    `        <feMergeNode in="SourceGraphic" />`,
    `      </feMerge>`,
    `    </filter>`,
    `  </defs>`,
    ``,
    `  <!-- Background track -->`,
    `  <path class="meter-track" d="${trackPath}" fill="none" />`,
    ``,
    `  <!-- Foreground fill arc -->`,
    `  <path class="meter-fill" d="${trackPath}" fill="none"`,
    `    stroke-dasharray="${arcLen.toFixed(1)}" stroke-dashoffset="${arcLen.toFixed(1)}" />`,
    ``,
    `  <!-- Tick marks -->`,
    `  <g class="meter-ticks">${renderTicks()}</g>`,
    ``,
    `  <!-- Needle -->`,
    `  <line class="meter-needle" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - 85}" />`,
    ``,
    `  <!-- Center dot -->`,
    `  <circle class="meter-center-dot" cx="${CX}" cy="${CY}" r="6" />`,
    `</svg>`,
  ].join('\n');
}

function renderOverlay() {
  return [
    `<div class="meter-overlay" aria-hidden="true">`,
    `  <span class="meter-score">0</span>`,
    `  <span class="meter-label">calm</span>`,
    `</div>`,
  ].join('\n');
}

// ─── Component ───────────────────────────────────────────────

export class RageMeter {
  constructor(container) {
    this.container = container;
    this._score = 0;
    this._level = 'calm';

    container.classList.add('rage-meter');
    container.innerHTML = [
      `<div class="meter-wrapper">`,
      `  ${renderSVG()}`,
      `  ${renderOverlay()}`,
      `</div>`,
    ].join('\n');

    // Cache DOM refs
    this._svg = container.querySelector('.rage-meter-svg');
    this._fillArc = container.querySelector('.meter-fill');
    this._needle = container.querySelector('.meter-needle');
    this._centerDot = container.querySelector('.meter-center-dot');
    this._scoreEl = container.querySelector('.meter-score');
    this._labelEl = container.querySelector('.meter-label');

    // Pre-position needle at score 0 (avoids visible initial animation)
    this._needle.style.transform = `rotate(${scoreToAngle(0)}deg)`;

    // Subscribe to fusion score updates
    this._unsub = eventBus.on('fusion:score', (data) => {
      this.update(data.smoothed);
    });
  }

  /**
   * Update gauge visuals to reflect a new score.
   * @param {number} score - Rage score 0-100
   */
  update(score) {
    const clamped = Math.max(0, Math.min(100, score));
    const level = getRageLevel(clamped);
    const angle = scoreToAngle(clamped);
    const arcLen = circumference(R) * (ARC_LENGTH / 360);
    const offset = arcLen - (clamped / 100) * arcLen;

    // Stroke-dashoffset drives arc fill amount
    this._fillArc.style.strokeDashoffset = offset.toFixed(1);

    // Needle rotation around gauge center
    this._needle.style.transform = `rotate(${angle}deg)`;

    // Dynamic CSS custom properties for color/glow/pulse
    this._svg.style.setProperty('--rage-current-color', level.color);
    this._svg.style.setProperty('--rage-current-glow', level.glow);
    this._svg.style.setProperty('--glow-pulse-duration', level.pulseDuration);

    // Center dot inherits level color
    this._centerDot.style.fill = level.color;

    // Text overlay
    this._scoreEl.textContent = Math.round(clamped);
    this._labelEl.textContent = level.name;

    // ARIA
    this._svg.setAttribute('aria-valuenow', Math.round(clamped));
    this._svg.setAttribute('aria-valuetext', `${level.name} - ${Math.round(clamped)}%`);

    this._score = clamped;
    this._level = level.name;
  }

  /**
   * Clean up event subscriptions.
   */
  destroy() {
    this._unsub?.();
  }
}
