/**
 * End-of-Session Summary Modal Component.
 * Displays session stats, distribution, and a static timeline chart
 * upon stopping a session, with Save or Discard actions.
 */
import { eventBus } from '../utils/event-bus.js';
import { SessionTimeline } from './timeline.js';
import { getRageColor } from '../utils/rage-levels.js';

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown Date';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateZonePercentages(histogram) {
  if (!histogram) return { calm: 0, focused: 0, tense: 0, angry: 0, rage: 0 };
  const total = histogram.reduce((a, b) => a + b, 0) || 1;

  // Histogram contains 10 bins corresponding to scores (0-9, 10-19, ..., 90-100)
  // Group them into the 5 rage zones:
  // Calm (0-20), Focused (21-40), Tense (41-60), Angry (61-80), RAGE (81-100)
  const calmCount = (histogram[0] || 0) + (histogram[1] || 0);
  const focusedCount = (histogram[2] || 0) + (histogram[3] || 0);
  const tenseCount = (histogram[4] || 0) + (histogram[5] || 0);
  const angryCount = (histogram[6] || 0) + (histogram[7] || 0);
  const rageCount = (histogram[8] || 0) + (histogram[9] || 0);

  return {
    calm: Math.round((calmCount / total) * 100),
    focused: Math.round((focusedCount / total) * 100),
    tense: Math.round((tenseCount / total) * 100),
    angry: Math.round((angryCount / total) * 100),
    rage: Math.round((rageCount / total) * 100),
  };
}

function simulateAlertCount(points, warningThreshold = 60, cooldownMs = 30000) {
  if (!points || points.length === 0) return 0;
  let count = 0;
  let lastAlertTime = 0;

  points.forEach(p => {
    const score = p.smoothed ?? p.raw ?? 0;
    if (score >= warningThreshold && (p.timestamp - lastAlertTime >= cooldownMs)) {
      count++;
      lastAlertTime = p.timestamp;
    }
  });

  return count;
}

export class SessionSummaryModal {
  /**
   * @param {SessionManager} sessionManager
   */
  constructor(sessionManager) {
    this._sessionManager = sessionManager;
    this._session = null;
    this._timeline = null;
    this._resolvePromise = null;

    this._render();
  }

  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'summary-wrapper fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4';
    wrapper.style.cssText = 'visibility: hidden;';

    wrapper.innerHTML = `
      <div class="summary-backdrop absolute inset-0 bg-slate-900/30 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-none z-[100]"></div>
      <div class="summary-modal w-full max-w-[480px] bg-[#E0E5EC] rounded-[24px] shadow-[0_15px_35px_rgba(0,0,0,0.15)] z-[101] scale-95 opacity-0 transition-all duration-300 flex flex-col p-6 pointer-events-auto neu-extruded" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Session Summary">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-[rgba(163,177,198,0.2)]">
          <div class="flex items-center gap-2">
            <iconify-icon icon="lucide:trophy" class="text-yellow-500 text-lg"></iconify-icon>
            <h2 class="font-jakarta font-extrabold text-lg text-fg tracking-tight">Session Summary</h2>
          </div>
          <span class="font-dm text-[9px] font-bold text-muted uppercase" id="summary-date"></span>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto py-4 space-y-4 neu-scroll max-h-[70vh]">
          <!-- Key Stats Grid -->
          <div class="grid grid-cols-2 gap-3">
            <div class="neu-inset rounded-[16px] p-3 text-center">
              <span class="font-dm text-[9px] font-bold text-muted uppercase block">Duration</span>
              <span class="font-mono text-sm font-bold text-fg block mt-0.5" id="summary-duration"></span>
            </div>
            <div class="neu-inset rounded-[16px] p-3 text-center" id="summary-avg-card">
              <span class="font-dm text-[9px] font-bold text-muted uppercase block">Avg Rage</span>
              <span class="font-mono text-sm font-bold text-fg block mt-0.5" id="summary-avg"></span>
            </div>
            <div class="neu-inset rounded-[16px] p-3 text-center">
              <span class="font-dm text-[9px] font-bold text-muted uppercase block">Peak Rage</span>
              <span class="font-mono text-sm font-bold text-fg block mt-0.5" id="summary-peak"></span>
            </div>
            <div class="neu-inset rounded-[16px] p-3 text-center">
              <span class="font-dm text-[9px] font-bold text-muted uppercase block">Alerts Triggered</span>
              <span class="font-mono text-sm font-bold text-fg block mt-0.5" id="summary-alerts"></span>
            </div>
          </div>

          <!-- Mini Timeline -->
          <section class="space-y-1.5">
            <h3 class="font-jakarta font-bold text-xs uppercase tracking-wider text-muted">Timeline Preview</h3>
            <div class="neu-inset rounded-[20px] p-3">
              <div class="relative h-[160px]">
                <canvas id="summary-timeline-canvas"></canvas>
              </div>
            </div>
          </section>

          <!-- Zone Breakdown -->
          <section class="space-y-2">
            <h3 class="font-jakarta font-bold text-xs uppercase tracking-wider text-muted font-bold">Time Spent by Zone</h3>
            <div class="neu-inset rounded-[20px] p-4 space-y-3">
              <!-- Calm -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-dm font-bold text-muted">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: var(--rage-calm)"></span>Calm</span>
                  <span class="text-fg" id="summary-percent-calm"></span>
                </div>
                <div class="w-full h-1.5 neu-inset-sm rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" id="summary-bar-calm" style="background: var(--rage-calm)"></div>
                </div>
              </div>
              <!-- Focused -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-dm font-bold text-muted">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: var(--rage-focused)"></span>Focused</span>
                  <span class="text-fg" id="summary-percent-focused"></span>
                </div>
                <div class="w-full h-1.5 neu-inset-sm rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" id="summary-bar-focused" style="background: var(--rage-focused)"></div>
                </div>
              </div>
              <!-- Tense -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-dm font-bold text-muted">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: var(--rage-tense)"></span>Tense</span>
                  <span class="text-fg" id="summary-percent-tense"></span>
                </div>
                <div class="w-full h-1.5 neu-inset-sm rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" id="summary-bar-tense" style="background: var(--rage-tense)"></div>
                </div>
              </div>
              <!-- Angry -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-dm font-bold text-muted">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: var(--rage-angry)"></span>Angry</span>
                  <span class="text-fg" id="summary-percent-angry"></span>
                </div>
                <div class="w-full h-1.5 neu-inset-sm rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" id="summary-bar-angry" style="background: var(--rage-angry)"></div>
                </div>
              </div>
              <!-- RAGE -->
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-dm font-bold text-muted">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: var(--rage-rage)"></span>RAGE</span>
                  <span class="text-fg" id="summary-percent-rage"></span>
                </div>
                <div class="w-full h-1.5 neu-inset-sm rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" id="summary-bar-rage" style="background: var(--rage-rage)"></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Footer Actions -->
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-[rgba(163,177,198,0.2)] mt-2">
          <button class="summary-discard neu-btn text-red-500 rounded-[16px] py-3.5 font-jakarta font-extrabold text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2" aria-label="Discard session">
            <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
            Discard
          </button>
          <button class="summary-save neu-btn text-violet rounded-[16px] py-3.5 font-jakarta font-extrabold text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2" aria-label="Save and close">
            <iconify-icon icon="lucide:save" class="text-sm"></iconify-icon>
            Save & Close
          </button>
        </div>
      </div>
    `;

    this._wrapper = wrapper;
    this._modal = wrapper.querySelector('.summary-modal');
    this._backdrop = wrapper.querySelector('.summary-backdrop');

    // Bind actions
    this._modal.querySelector('.summary-save').addEventListener('click', () => this._onSave());
    this._modal.querySelector('.summary-discard').addEventListener('click', () => this._onDiscard());

    document.body.appendChild(wrapper);
  }

  /**
   * Open the summary modal for a completed session.
   * Returns a promise that resolves with 'save' or 'discard'.
   * @param {SessionData} session
   * @returns {Promise<'save'|'discard'>}
   */
  show(session) {
    if (this._resolvePromise) return Promise.resolve('save');

    this._session = session;
    const stats = session.stats || { avg: 0, max: 0, spikes: 0, duration: 0, histogram: Array(10).fill(0) };
    const cardColor = getRageColor(stats.avg);

    // Populate data
    this._wrapper.querySelector('#summary-date').textContent = formatDate(session.startedAt);
    this._wrapper.querySelector('#summary-duration').textContent = formatDuration(stats.duration);
    this._wrapper.querySelector('#summary-avg').textContent = stats.avg;
    this._wrapper.querySelector('#summary-peak').textContent = stats.max;
    this._wrapper.querySelector('#summary-avg-card').style.borderTop = `3px solid ${cardColor}`;

    const warningThreshold = 60; // default warning threshold
    const alertsCount = simulateAlertCount(session.dataPoints, warningThreshold);
    this._wrapper.querySelector('#summary-alerts').textContent = alertsCount;

    // Set percentages and bars
    const percentages = calculateZonePercentages(stats.histogram);
    const zones = ['calm', 'focused', 'tense', 'angry', 'rage'];
    zones.forEach(z => {
      this._wrapper.querySelector(`#summary-percent-${z}`).textContent = `${percentages[z]}%`;
      this._wrapper.querySelector(`#summary-bar-${z}`).style.width = `${percentages[z]}%`;
    });

    // Make visible
    this._wrapper.style.visibility = 'visible';
    this._wrapper.className = 'summary-wrapper fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center p-4';

    requestAnimationFrame(() => {
      this._backdrop.classList.remove('opacity-0', 'pointer-events-none');
      this._backdrop.classList.add('opacity-100', 'pointer-events-auto');
      this._modal.classList.remove('scale-95', 'opacity-0');
      this._modal.classList.add('scale-100', 'opacity-100');
    });

    // Setup timeline chart
    const canvas = this._wrapper.querySelector('#summary-timeline-canvas');
    if (canvas) {
      this._timeline = new SessionTimeline(canvas, { historicalData: session.dataPoints });
    }

    return new Promise((resolve) => {
      this._resolvePromise = resolve;
    });
  }

  _onSave() {
    this._close();
    if (this._resolvePromise) {
      this._resolvePromise('save');
      this._resolvePromise = null;
    }
  }

  async _onDiscard() {
    if (confirm('Are you sure you want to discard this session? It will be permanently deleted.')) {
      try {
        await this._sessionManager.deleteSession(this._session.id);
        this._close();
        if (this._resolvePromise) {
          this._resolvePromise('discard');
          this._resolvePromise = null;
        }
      } catch (err) {
        console.error('Failed to delete/discard session:', err);
        alert('Failed to discard session.');
      }
    }
  }

  _close() {
    if (this._timeline) {
      this._timeline.destroy();
      this._timeline = null;
    }

    this._backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    this._backdrop.classList.add('opacity-0', 'pointer-events-none');
    this._modal.classList.remove('scale-100', 'opacity-100');
    this._modal.classList.add('scale-95', 'opacity-0');

    this._wrapper.className = 'summary-wrapper fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4';

    setTimeout(() => {
      this._wrapper.style.visibility = 'hidden';
    }, 300);
  }

  destroy() {
    this._close();
    this._wrapper.remove();
  }
}
