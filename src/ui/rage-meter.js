/**
 * Rage Meter — Neumorphism full-circle SVG dial.
 * 360° ring with animated fill, chips, trend indicator.
 * Subscribes to fusion:score events.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel } from '../utils/rage-levels.js';

function renderMeterCard() {
  return `
    <section class="neu-rage-glow rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel w-full" aria-label="Rage meter">
      <div class="flex flex-col items-center">
        <div class="flex items-center gap-2 mb-5">
          <span class="font-dm text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Rage Level</span>
          <span class="neu-inset-sm rounded-full px-2 py-[2px] flex items-center gap-1">
            <span class="live-dot w-1.5 h-1.5 rounded-full"></span>
            <span class="font-dm text-[9px] font-bold uppercase tracking-wider" style="color: var(--rage-current-color)" id="live-badge-label">Live</span>
          </span>
        </div>

        <!-- Radial Gauge -->
        <div class="neu-inset-deep rounded-full p-4 lg:p-6 relative w-full max-w-[220px] aspect-square mx-auto">
          <div class="relative w-full h-full">
            <!-- SVG ring -->
            <svg viewBox="0 0 200 200" class="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="88" stroke="rgba(163,177,198,0.18)" stroke-width="8" fill="none" />
              <circle id="rage-progress" cx="100" cy="100" r="88" stroke="#f97316" stroke-width="10" fill="none"
                      stroke-linecap="round" stroke-dasharray="552.92" stroke-dashoffset="552.92"
                      class="rage-dial-progress" style="filter: drop-shadow(0 0 5px var(--rage-current-glow));" />
              <!-- Tick marks -->
              <g stroke="rgba(163,177,198,0.35)" stroke-width="2" stroke-linecap="round">
                <line x1="100" y1="20" x2="100" y2="28"/>
                <line x1="174" y1="40" x2="168" y2="46" transform="rotate(15 130 120)"/>
                <line x1="180" y1="100" x2="172" y2="100"/>
                <line x1="174" y1="160" x2="168" y2="154"/>
                <line x1="100" y1="180" x2="100" y2="172"/>
                <line x1="26" y1="160" x2="32" y2="154"/>
                <line x1="20" y1="100" x2="28" y2="100"/>
                <line x1="26" y1="40" x2="32" y2="46"/>
              </g>
            </svg>
            <!-- Center -->
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span id="rage-score" class="rage-score-num font-jakarta font-extrabold leading-none tracking-tight" style="color: var(--rage-current-color); font-size: clamp(2rem, 8vw, 3.5rem);">0</span>
              <span id="rage-label" class="font-dm text-[11px] font-bold uppercase tracking-[0.14em] mt-1" style="color: var(--rage-current-color)">Calm</span>
              <span id="rage-peak" class="font-mono text-[10px] text-muted mt-0.5">peak --</span>
            </div>
          </div>
        </div>

        <!-- Scale chips -->
        <div class="flex flex-wrap justify-center gap-1.5 mt-5" id="meter-chips"></div>

        <!-- Trend indicator -->
        <div class="mt-4 w-full neu-inset rounded-[16px] px-3 py-2 flex items-center justify-between">
          <span class="font-dm text-[10px] font-bold uppercase tracking-wider text-muted">Trend</span>
          <div class="flex items-center gap-1.5">
            <iconify-icon icon="lucide:trending-up" class="text-base" style="color: var(--rage-current-color)" id="meter-trend-icon"></iconify-icon>
            <span class="font-mono text-xs text-fg font-bold" id="meter-trend">--</span>
          </div>
        </div>
      </div>
    </section>
  `;
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
    const raised = '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)';
    return `<span class="px-2 py-1 rounded-full text-[9px] font-dm font-bold uppercase tracking-wider rage-meter-chip" style="background:#E0E5EC;color:${l.color};box-shadow:${raised};transition:box-shadow var(--transition-fast)" data-level="${l.label}">${l.label}</span>`;
  }).join('\n');
}

// ─── Component ───────────────────────────────────────────────

export class RageMeter {
  constructor(container) {
    this.container = container;
    this._score = 0;
    this._peak = 0;
    this._level = 'Calm';

    container.innerHTML = renderMeterCard();

    // Cache refs
    this._fillArc = container.querySelector('#rage-progress');
    this._scoreEl = container.querySelector('#rage-score');
    this._labelEl = container.querySelector('#rage-label');
    this._peakEl = container.querySelector('#rage-peak');
    this._trendEl = container.querySelector('#meter-trend');
    this._trendIcon = container.querySelector('#meter-trend-icon');
    this._chipsEl = container.querySelector('#meter-chips');
    this._liveBadgeLabel = container.querySelector('#live-badge-label');

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

    if (this._fillArc) {
      this._fillArc.setAttribute('stroke-dashoffset', offset.toFixed(2));
      this._fillArc.setAttribute('stroke', level.color);
    }

    const root = document.documentElement;
    root.style.setProperty('--rage-current-color', level.color);
    root.style.setProperty('--rage-current-glow', level.glow);
    root.style.setProperty('--glow-pulse-duration', level.pulseDuration);

    if (this._scoreEl) {
      this._scoreEl.textContent = Math.round(clamped);
      this._scoreEl.style.color = level.color;
    }
    if (this._labelEl) {
      this._labelEl.textContent = level.name;
      this._labelEl.style.color = level.color;
    }
    if (this._liveBadgeLabel) {
      this._liveBadgeLabel.style.color = level.color;
    }

    if (clamped > this._peak) this._peak = clamped;
    if (this._peakEl) {
      this._peakEl.textContent = 'peak ' + Math.round(this._peak);
    }

    const prev = this._score;
    const delta = Math.round(clamped - prev);
    if (this._trendEl) {
      if (delta > 0) {
        if (this._trendIcon) {
          this._trendIcon.setAttribute('icon', 'lucide:trending-up');
          this._trendIcon.style.color = level.color;
        }
        this._trendEl.textContent = '+' + delta + ' pts';
      } else if (delta < 0) {
        if (this._trendIcon) {
          this._trendIcon.setAttribute('icon', 'lucide:trending-down');
          this._trendIcon.style.color = 'var(--teal)';
        }
        this._trendEl.textContent = delta + ' pts';
      } else {
        if (this._trendIcon) {
          this._trendIcon.setAttribute('icon', 'lucide:minimize-2');
          this._trendIcon.style.color = 'var(--muted)';
        }
        this._trendEl.textContent = '--';
      }
    }

    // Update active chip styling
    if (this._chipsEl) {
      const chips = this._chipsEl.querySelectorAll('.rage-meter-chip');
      chips.forEach(c => {
        const isCurrent = c.getAttribute('data-level').toLowerCase() === level.name.toLowerCase();
        if (isCurrent) {
          c.style.boxShadow = 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)';
        } else {
          c.style.boxShadow = '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)';
        }
      });
    }

    this._score = clamped;
    this._level = level.name;
  }

  destroy() {
    this._unsub?.();
  }
}
