/**
 * Session History Component.
 * Modal panel that lists past sessions, displays sparklines,
 * and allows detail viewing (via SessionTimeline) and deletion.
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

function generateSparklinePath(points, width = 120, height = 30) {
  if (!points || points.length === 0) return '';
  const scores = points.map(pt => pt.smoothed ?? pt.raw ?? 0);
  if (scores.length === 1) {
    const y = height - (scores[0] / 100) * height;
    return `M 0 ${y} L ${width} ${y}`;
  }
  return scores.map((val, idx) => {
    const x = (idx / (scores.length - 1)) * width;
    const y = height - (val / 100) * height;
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export class SessionHistory {
  /**
   * @param {SessionManager} sessionManager
   */
  constructor(sessionManager) {
    this._sessionManager = sessionManager;
    this._isOpen = false;
    this._currentView = 'list'; // 'list' | 'detail'
    this._selectedSession = null;
    this._detailTimeline = null;
    this._previouslyFocused = null;

    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);

    this._render();
  }

  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'history-wrapper fixed inset-0 z-[100] pointer-events-none';
    wrapper.style.cssText = 'visibility: hidden;';

    wrapper.innerHTML = `
      <div class="history-backdrop absolute inset-0 bg-slate-900/30 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-none z-[100]"></div>
      <div class="history-panel fixed top-0 bottom-0 left-0 md:left-auto md:right-0 w-full max-w-[520px] bg-[#E0E5EC] shadow-[-10px_0_30px_rgba(0,0,0,0.15)] z-[101] translate-x-full transition-transform duration-300 flex flex-col pointer-events-auto" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Session History">
        <!-- Dynamic Content Injected Here -->
      </div>
    `;

    this._wrapper = wrapper;
    this._panel = wrapper.querySelector('.history-panel');
    this._backdrop = wrapper.querySelector('.history-backdrop');

    document.body.appendChild(wrapper);
  }

  _showListView() {
    this._currentView = 'list';
    if (this._detailTimeline) {
      this._detailTimeline.destroy();
      this._detailTimeline = null;
    }

    this._panel.innerHTML = `
      <!-- Header -->
      <div class="p-5 border-b border-[rgba(163,177,198,0.2)] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <iconify-icon icon="lucide:history" class="text-violet text-lg"></iconify-icon>
          <h2 class="font-jakarta font-extrabold text-lg text-fg tracking-tight">Session History</h2>
        </div>
        <button class="history-close neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Close history">
          <iconify-icon icon="lucide:x" class="text-muted text-sm"></iconify-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="history-body flex-1 overflow-y-auto p-5 space-y-4 neu-scroll" id="history-list-container">
        <div class="flex items-center justify-center py-12 text-muted">
          <iconify-icon icon="lucide:loader" class="text-2xl animate-spin"></iconify-icon>
        </div>
      </div>
    `;

    this._panel.querySelector('.history-close').addEventListener('click', () => this.close());
    this._loadSessions();
  }

  async _loadSessions() {
    const listContainer = this._panel.querySelector('#history-list-container');
    try {
      const sessions = await this._sessionManager.getAllSessions();
      // Sort in reverse chronological order
      sessions.sort((a, b) => b.startedAt - a.startedAt);

      if (sessions.length === 0) {
        listContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div class="neu-inset-sm w-16 h-16 rounded-full flex items-center justify-center text-muted/50">
              <iconify-icon icon="lucide:folder-open" class="text-3xl"></iconify-icon>
            </div>
            <div class="space-y-1">
              <p class="font-dm text-sm font-bold text-fg">No sessions found</p>
              <p class="font-dm text-xs text-muted">Start recording a gaming session to see it here.</p>
            </div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      sessions.forEach(session => {
        const stats = session.stats || { avg: 0, max: 0, spikes: 0, duration: 0 };
        const sparkPath = generateSparklinePath(session.dataPoints);
        const cardColor = getRageColor(stats.avg);

        const card = document.createElement('div');
        card.className = 'history-item-card neu-extruded rounded-[20px] p-4 flex flex-col gap-3 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all relative group';
        card.dataset.id = session.id;

        card.innerHTML = `
          <div class="flex items-start justify-between min-w-0">
            <div class="min-w-0">
              <h3 class="font-jakarta font-bold text-sm text-fg truncate pr-8">${session.gameName || 'Session'}</h3>
              <p class="font-dm text-[10px] font-bold text-muted uppercase mt-0.5">${formatDate(session.startedAt)}</p>
            </div>
            <button class="delete-session-btn absolute top-3 right-3 w-8 h-8 rounded-full bg-red-100/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 neu-btn" aria-label="Delete session" data-id="${session.id}">
              <iconify-icon icon="lucide:trash-2" class="text-sm"></iconify-icon>
            </button>
          </div>

          <div class="flex items-center justify-between gap-4 mt-1">
            <!-- Stats -->
            <div class="grid grid-cols-3 gap-2 flex-1">
              <div class="neu-inset rounded-[12px] p-2 text-center">
                <span class="font-dm text-[8px] font-bold text-muted uppercase block">Duration</span>
                <span class="font-mono text-xs font-bold text-fg block mt-0.5">${formatDuration(stats.duration)}</span>
              </div>
              <div class="neu-inset rounded-[12px] p-2 text-center" style="border-left: 2px solid ${cardColor}">
                <span class="font-dm text-[8px] font-bold text-muted uppercase block">Avg Rage</span>
                <span class="font-mono text-xs font-bold text-fg block mt-0.5">${stats.avg}</span>
              </div>
              <div class="neu-inset rounded-[12px] p-2 text-center">
                <span class="font-dm text-[8px] font-bold text-muted uppercase block">Peak</span>
                <span class="font-mono text-xs font-bold text-fg block mt-0.5">${stats.max}</span>
              </div>
            </div>

            <!-- Sparkline -->
            <div class="w-[100px] h-[36px] flex items-center justify-center rounded-[12px] neu-inset p-1 bg-white/20">
              ${sparkPath ? `
                <svg viewBox="0 0 120 30" class="w-full h-full overflow-visible">
                  <path d="${sparkPath}" fill="none" stroke="${cardColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              ` : '<span class="text-[9px] font-dm text-muted font-bold">No Data</span>'}
            </div>
          </div>
        `;

        card.addEventListener('click', (e) => {
          if (e.target.closest('.delete-session-btn')) return;
          this._showDetailView(session);
        });

        card.querySelector('.delete-session-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this._confirmDelete(session.id, session.gameName || 'Session');
        });

        listContainer.appendChild(card);
      });

    } catch (err) {
      console.error('Failed to load history sessions:', err);
      listContainer.innerHTML = `
        <div class="p-4 text-center text-red-500 font-dm text-xs">
          Failed to load history sessions.
        </div>
      `;
    }
  }

  _showDetailView(session) {
    this._currentView = 'detail';
    this._selectedSession = session;

    const stats = session.stats || { avg: 0, max: 0, spikes: 0, duration: 0, spikesPercent: 0 };
    const cardColor = getRageColor(stats.avg);

    this._panel.innerHTML = `
      <!-- Header -->
      <div class="p-5 border-b border-[rgba(163,177,198,0.2)] flex items-center justify-between">
        <button class="history-back neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Back to list">
          <iconify-icon icon="lucide:arrow-left" class="text-muted text-sm"></iconify-icon>
        </button>
        <div class="flex-1 text-center min-w-0 px-3">
          <h2 class="font-jakarta font-extrabold text-sm text-fg truncate">${session.gameName || 'Session Details'}</h2>
          <p class="font-dm text-[9px] font-bold text-muted uppercase mt-0.5">${formatDate(session.startedAt)}</p>
        </div>
        <button class="history-close neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Close history">
          <iconify-icon icon="lucide:x" class="text-muted text-sm"></iconify-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="history-body flex-1 overflow-y-auto p-5 space-y-5 neu-scroll">
        <!-- Stats Summary grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="neu-inset rounded-[16px] p-3 text-center">
            <span class="font-dm text-[9px] font-bold text-muted uppercase block">Duration</span>
            <span class="font-mono text-sm font-bold text-fg block mt-1">${formatDuration(stats.duration)}</span>
          </div>
          <div class="neu-inset rounded-[16px] p-3 text-center" style="border-top: 3px solid ${cardColor}">
            <span class="font-dm text-[9px] font-bold text-muted uppercase block">Avg Rage</span>
            <span class="font-mono text-sm font-bold text-fg block mt-1">${stats.avg}</span>
          </div>
          <div class="neu-inset rounded-[16px] p-3 text-center">
            <span class="font-dm text-[9px] font-bold text-muted uppercase block">Peak Rage</span>
            <span class="font-mono text-sm font-bold text-fg block mt-1">${stats.max}</span>
          </div>
          <div class="neu-inset rounded-[16px] p-3 text-center">
            <span class="font-dm text-[9px] font-bold text-muted uppercase block">Spikes</span>
            <span class="font-mono text-sm font-bold text-fg block mt-1">${stats.spikes} <span class="text-[9px] text-muted">pts</span></span>
          </div>
        </div>

        <!-- Chart Well -->
        <section class="space-y-2">
          <h3 class="font-jakarta font-bold text-xs uppercase tracking-wider text-muted">Session Timeline</h3>
          <div class="neu-inset-deep rounded-[20px] p-3">
            <div class="relative h-[220px]">
              <canvas id="history-detail-canvas"></canvas>
            </div>
          </div>
        </section>

        <!-- Stats Breakdown -->
        <section class="space-y-3">
          <h3 class="font-jakarta font-bold text-xs uppercase tracking-wider text-muted">Rage Distribution</h3>
          <div class="neu-inset rounded-[20px] p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between text-xs font-dm font-bold text-muted">
              <span>Time in Spike Zone (&ge;80)</span>
              <span class="text-fg">${stats.spikesPercent}%</span>
            </div>
            <div class="w-full h-2 neu-inset-sm rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width: ${stats.spikesPercent}%; background: var(--rage-rage);"></div>
            </div>
          </div>
        </section>
      </div>
    `;

    this._panel.querySelector('.history-close').addEventListener('click', () => this.close());
    this._panel.querySelector('.history-back').addEventListener('click', () => this._showListView());

    // Initialize historical chart
    const canvas = this._panel.querySelector('#history-detail-canvas');
    if (canvas) {
      this._detailTimeline = new SessionTimeline(canvas, { historicalData: session.dataPoints });
    }
  }

  async _confirmDelete(id, name) {
    if (confirm(`Are you sure you want to delete the session "${name}"? This action cannot be undone.`)) {
      try {
        await this._sessionManager.deleteSession(id);
        this._loadSessions();
      } catch (err) {
        console.error('Failed to delete session:', err);
        alert('Failed to delete session.');
      }
    }
  }

  _handleKeydown(e) {
    if (e.key === 'Escape' && this._isOpen) {
      this.close();
    }
  }

  _handleBackdropClick() {
    this.close();
  }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._previouslyFocused = document.activeElement;

    this._showListView();

    this._wrapper.style.visibility = 'visible';
    this._wrapper.className = 'history-wrapper fixed inset-0 z-[100] pointer-events-auto';

    requestAnimationFrame(() => {
      this._backdrop.classList.remove('opacity-0', 'pointer-events-none');
      this._backdrop.classList.add('opacity-100', 'pointer-events-auto');
      this._panel.classList.remove('translate-x-full');
      this._panel.classList.add('translate-x-0');
      this._panel.setAttribute('aria-hidden', 'false');
    });

    document.addEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    if (this._detailTimeline) {
      this._detailTimeline.destroy();
      this._detailTimeline = null;
    }

    this._backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    this._backdrop.classList.add('opacity-0', 'pointer-events-none');
    this._panel.classList.remove('translate-x-0');
    this._panel.classList.add('translate-x-full');
    this._panel.setAttribute('aria-hidden', 'true');

    this._wrapper.className = 'history-wrapper fixed inset-0 z-[100] pointer-events-none';

    document.removeEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.removeEventListener('click', this._boundHandleBackdrop);

    setTimeout(() => {
      if (!this._isOpen) {
        this._wrapper.style.visibility = 'hidden';
      }
    }, 300);

    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
  }

  destroy() {
    this.close();
    this._wrapper.remove();
  }
}
