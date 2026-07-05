/**
 * Rage Meter — Neumorphism full-circle SVG dial.
 * 360° ring with animated fill, chips, trend indicator.
 * Subscribes to fusion:score events.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel } from '../utils/rage-levels.js';

const SVGB = (s) => s;

function renderMeterCard() {
  return [
    '<section class="rage-meter-card neu-rage-glow" aria-label="Rage meter">',
    '  <div class="rage-meter-eyebrow">',
    '    <span class="rage-meter-eyebrow-label">Rage Level</span>',
    '    <span class="rage-meter-live-badge">',
    '      <span class="rage-meter-live-dot live-dot"></span>',
    '      <span class="rage-meter-live-text">Live</span>',
    '    </span>',
    '  </div>',
    '  <div class="rage-meter-well neu-inset-deep" style="border-radius:50%;padding:1.5rem;display:flex;align-items:center;justify-content:center">',
    '    <div class="rage-meter-svg-container">',
    '      <svg class="rage-meter-svg" viewBox="0 0 200 200" style="transform:rotate(-90deg)">',
    '        <circle class="meter-track" cx="100" cy="100" r="88" />',
    '        <circle class="meter-fill" cx="100" cy="100" r="88" stroke-dasharray="552.92" stroke-dashoffset="552.92" />',
    '        <g class="meter-ticks">',
    ...Array.from({length:8}, (_, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const x1 = 100 + 80 * Math.cos(a), y1 = 100 + 80 * Math.sin(a);
      const x2 = 100 + 88 * Math.cos(a), y2 = 100 + 88 * Math.sin(a);
      return `          <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
    }).join('\n'),
    '        </g>',
    '      </svg>',
    '      <div class="meter-overlay" aria-hidden="true">',
    '        <span class="meter-score">0</span>',
    '        <span class="meter-label">Calm</span>',
    '        <span class="meter-peak">peak --</span>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="rage-meter-chips" id="meter-chips"></div>',
    '  <div class="rage-meter-trend">',
    '    <span class="rage-meter-trend-label">Trend</span>',
    '    <span class="rage-meter-trend-value">',
    '      <iconify-icon icon="lucide:minimize-2"></iconify-icon>',
    '      <span id="meter-trend">--</span>',
    '    </span>',
    '  </div>',
    '</section>',
  ].join('\n');
}

const RAGE_LEVEL_CHIPS = [
  { max: 20, label: 'Calm', color: '#22c55e' },
  { max: 40, label: 'Focused', color: '#84cc16' },
  { max: 60, label: 'Heated', color: '#eab308' },
  { max: 80, label: 'Tilted', color: '#f97316' },
  { max: 100, label: 'Rage', color: '#ef4444' },
];

function renderChips() {
  return RAGE_LEVEL_CHIPS.map((l, i) => {
    const inset = i < 2 ? 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' : '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)';
    return `<span class="rage-meter-chip" style="color:${l.color};box-shadow:${inset}" data-level="${l.label}">${l.label}</span>`;
  }).join('\n');
}

// ─── Component ───────────────────────────────────────────────

export class RageMeter {
  constructor(container) {
    this.container = container;
    this._score = 0;
    this._peak = 0;
    this._level = 'Calm';

    container.classList.add('rage-meter');
    container.innerHTML = renderMeterCard();

    // Cache refs
    this._fillArc = container.querySelector('.meter-fill');
    this._scoreEl = container.querySelector('.meter-score');
    this._labelEl = container.querySelector('.meter-label');
    this._peakEl = container.querySelector('.meter-peak');
    this._trendEl = container.querySelector('#meter-trend');
    this._chipsEl = container.querySelector('#meter-chips');

    // Render chips
    if (this._chipsEl) this._chipsEl.innerHTML = renderChips();

    // Subscribe
    this._unsub = eventBus.on('fusion:score', (data) => {
      this.update(data.smoothed);
    });
  }

  update(score) {
    const clamped = Math.max(0, Math.min(100, score));
    const level = getRageLevel(clamped);
    const circ = 2 * Math.PI * 88;
    const offset = circ * (1 - clamped / 100);

    this._fillArc.style.strokeDashoffset = offset.toFixed(2);
    this._fillArc.style.stroke = level.color;

    const root = document.documentElement;
    root.style.setProperty('--rage-current-color', level.color);
    root.style.setProperty('--rage-current-glow', level.glow);
    root.style.setProperty('--glow-pulse-duration', level.pulseDuration);

    this._scoreEl.textContent = Math.round(clamped);
    this._scoreEl.style.color = level.color;
    this._labelEl.textContent = level.name;
    this._labelEl.style.color = level.color;

    if (clamped > this._peak) this._peak = clamped;
    this._peakEl.textContent = 'peak ' + Math.round(this._peak);

    const prev = this._score;
    const delta = Math.round(clamped - prev);
    if (this._trendEl) {
      if (delta > 0) {
        this._trendEl.parentElement.querySelector('iconify-icon').setAttribute('icon', 'lucide:trending-up');
        this._trendEl.textContent = '+' + delta + ' pts';
      } else if (delta < 0) {
        this._trendEl.parentElement.querySelector('iconify-icon').setAttribute('icon', 'lucide:trending-down');
        this._trendEl.textContent = delta + ' pts';
      } else {
        this._trendEl.textContent = '--';
      }
    }

    this._score = clamped;
    this._level = level.name;
  }

  destroy() {
    this._unsub?.();
  }
}
