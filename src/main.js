/**
 * RageRadar — Main Application Entry Point.
 *
 * Orchestrates all modules and UI components into a cohesive
 * dark-tech / HUD-style emotion detection dashboard.
 *
 * Layout: 3-column CSS Grid
 *   sidebar (300px) || main (1fr) || right-panel (280px)
 */
import './styles/main.css';

import { CameraModule } from './modules/camera.js';
import { MicrophoneModule } from './modules/microphone.js';
import { FusionEngine } from './modules/fusion.js';
import { AlertSystem } from './modules/alerts.js';
import { SessionManager } from './modules/session.js';
import { eventBus } from './utils/event-bus.js';
import { getRageLevel } from './utils/rage-levels.js';
import { loadSettings, saveSettings } from './utils/settings-store.js';

import { RageMeter } from './ui/rage-meter.js';
import { SessionTimeline } from './ui/timeline.js';
import { ToastManager } from './ui/toast.js';
import { SettingsPanel } from './ui/settings.js';
import { WebcamPreview } from './ui/webcam-preview.js';
import { SessionControls } from './ui/controls.js';
import { MobileMenu } from './ui/mobile-menu.js';
import { SessionHistory } from './ui/session-history.js';
import { SessionSummaryModal } from './ui/session-summary.js';
import { AnalyticsEngine } from './modules/analytics.js';
import { AnalyticsDashboard } from './ui/analytics-dashboard.js';
import { CooldownEngine } from './modules/cooldown.js';
import { BreathingOverlay } from './ui/breathing-overlay.js';
import { BreakReminder } from './ui/break-reminder.js';

// ─── SVG icons (inline, minimal) ──────────────────────

const SVG_SETTINGS =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

const SVG_MIC =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><line x1="19" y1="10" x2="18.1" y2="10"/><line x1="4.9" y1="10" x2="4" y2="10"/><path d="M17 10a5 5 0 0 1-10 0"/></svg>';

const SVG_CAM =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

// ─── Configuration ──────────────────────────────────────

const TIMER_INTERVAL_MS = 1000;
const STATS_UPDATE_INTERVAL_MS = 2000;
const RAGE_ANNOUNCE_COOLDOWN_MS = 5000;

// ─── RageRadarApp ──────────────────────────────────────

class RageRadarApp {
  constructor() {
    this._settings = loadSettings();

    // Modules (lazy-init until first start)
    this._camera = null;
    this._microphone = null;
    this._fusion = null;
    this._alerts = null;
    this._sessionManager = new SessionManager();

    // UI components (built during render)
    this._meter = null;
    this._timeline = null;
    this._toasts = null;
    this._settingsPanel = null;
    this._webcamPreview = null;
    this._controls = null;
    this._sessionHistory = null;
    this._summaryModal = null;
    this._analyticsEngine = null;
    this._analyticsDashboard = null;
    this._cooldownEngine = null;
    this._breathingOverlay = null;
    this._breakReminder = null;

    // State
    this._sessionStartTime = 0;
    this._elapsedSeconds = 0;
    this._timerInterval = null;
    this._sessionDataPoints = [];
    this._alertLogEntries = [];
    this._lastAnnouncedLevel = '';
    this._lastAnnounceTime = 0;
    this._isActive = false;

    // Debug exposure
    this._settingsApplied = false;
  }

  // ─── Bootstrap ──────────────────────────────────────────

  async init() {
    await this._sessionManager.init();
    this._renderDashboard();
    this._initModules();
    this._subscribeEvents();
    this._bindKeyboardShortcuts();

    // Load last session stats
    await this._loadLastSessionStats();

    // Auto-open settings if first visit?
    // Just render and wait.
    eventBus.emit('app:ready');
  }

  // ─── Render Dashboard Layout ────────────────────────────

  _renderDashboard() {
    const app = document.querySelector('#app');
    app.innerHTML = '';

    // Create wrapper aligned with max-width container of target design
    const wrapper = document.createElement('div');
    wrapper.className = 'relative w-full max-w-[1920px] mx-auto p-3 lg:px-6 lg:py-4 z-[1] lg:h-[100dvh] lg:flex lg:flex-col lg:overflow-y-auto neu-scroll';

    // ── Header ──────────────────────────────────────────
    const header = document.createElement('header');
    header.className = 'neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel mb-3 lg:mb-4 flex-shrink-0';
    header.setAttribute('role', 'banner');
    header.setAttribute('aria-label', 'Dashboard header');
    header.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <button id="hamburger-btn" class="lg:hidden neu-btn w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] flex items-center justify-center" aria-label="Open menu">
            <iconify-icon icon="lucide:menu" class="text-fg text-lg"></iconify-icon>
          </button>
          <div class="flex items-center gap-2.5">
            <div class="neu-extruded-sm rounded-[14px] w-11 h-11 flex items-center justify-center">
              <iconify-icon icon="lucide:radar" class="text-violet text-xl"></iconify-icon>
            </div>
            <h1 class="font-jakarta font-extrabold text-lg sm:text-xl lg:text-2xl tracking-tight">
              <span class="text-fg">Rage</span><span class="text-violet">Radar</span>
            </h1>
          </div>
        </div>

        <!-- Session Timer -->
        <div class="hidden lg:flex items-center gap-2 neu-inset-sm rounded-full px-4 py-2">
          <iconify-icon icon="lucide:timer" class="text-muted text-sm"></iconify-icon>
          <span id="session-timer" class="font-mono font-medium text-sm text-muted tabular-nums">00:00</span>
          <span class="w-px h-3.5 bg-[rgba(163,177,198,0.4)] mx-1"></span>
          <span class="font-dm text-[10px] font-bold uppercase tracking-wider text-muted">Active</span>
          <span class="live-dot w-1.5 h-1.5 rounded-full"></span>
        </div>

        <!-- Right Actions -->
        <div class="flex items-center gap-2.5">
          <!-- Mobile timer pill -->
          <div class="lg:hidden neu-inset-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <span class="live-dot w-1.5 h-1.5 rounded-full"></span>
            <span id="session-timer-mobile" class="font-mono text-xs text-fg font-medium">00:00</span>
          </div>
          
          <button id="notification-btn" class="neu-btn w-11 h-11 rounded-full flex items-center justify-center relative" aria-label="Notifications">
            <iconify-icon icon="lucide:bell" class="text-muted text-lg"></iconify-icon>
            <span id="notif-dot" class="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--rage-current-color)] shadow-[var(--rage-current-glow)]" style="display:none"></span>
          </button>
          
          <button id="btn-analytics" class="neu-btn w-11 h-11 rounded-full flex items-center justify-center" aria-label="Open analytics" title="Analytics">
            <iconify-icon icon="lucide:bar-chart-3" class="text-muted text-lg"></iconify-icon>
          </button>
          
          <button id="btn-settings" class="settings-btn neu-btn w-11 h-11 rounded-full flex items-center justify-center" aria-label="Open settings" title="Settings (Comma)">
            <iconify-icon icon="lucide:settings" class="text-muted text-lg"></iconify-icon>
          </button>
        </div>
      </div>
    `;
    // Skip link for keyboard users
    const skipLink = document.createElement('a');
    skipLink.href = '#dashboard-grid';
    skipLink.className = 'skip-link sr-only focus:not-sr-only';
    skipLink.textContent = 'Skip to main content';
    wrapper.insertBefore(skipLink, wrapper.firstChild);

    wrapper.appendChild(header);

    // ── Main Dashboard Grid ─────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 lg:grid-cols-[240px_1fr] 2xl:grid-cols-[280px_1fr_300px] gap-3 lg:gap-4 lg:flex-1';
    grid.id = 'dashboard-grid';

    // ── Left Sidebar (Rage Meter + Webcam Preview + Device Status) ──────
    const sidebar = document.createElement('aside');
    sidebar.className = 'flex flex-col gap-3 lg:gap-4 min-w-0 lg:h-full lg:overflow-visible';
    sidebar.setAttribute('aria-label', 'Sidebar');
    
    const meterContainer = document.createElement('div');
    meterContainer.id = 'meter-container';
    sidebar.appendChild(meterContainer);

    const webcamContainer = document.createElement('div');
    webcamContainer.id = 'webcam-container';
    sidebar.appendChild(webcamContainer);

    grid.appendChild(sidebar);

    // ── Main Panel (Rage Timeline + Session Insights) ──
    const main = document.createElement('main');
    main.className = 'flex flex-col gap-3 lg:gap-4 min-w-0 lg:h-full lg:overflow-visible';
    main.setAttribute('aria-label', 'Main content');

    // Timeline panel
    const timelinePanel = document.createElement('section');
    timelinePanel.className = 'neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel flex-shrink-0';
    timelinePanel.setAttribute('aria-label', 'Rage timeline');
    timelinePanel.innerHTML = `
      <div class="flex items-center justify-between mb-3 gap-2">
        <div class="flex items-center gap-3">
          <div>
            <h2 class="font-jakarta font-bold text-lg lg:text-xl text-fg tracking-tight">Rage Timeline</h2>
            <p class="font-dm text-xs text-muted mt-0.5">Continuous detection · last 60s roll</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="neu-inset-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <span class="live-dot w-1.5 h-1.5 rounded-full"></span>
            <span class="font-dm text-[10px] font-bold uppercase tracking-wider" id="timeline-live-badge" style="color: var(--rage-current-color)">WAITING</span>
          </div>
          <button class="neu-btn rounded-full px-3 py-1.5 font-dm text-xs font-medium text-muted flex items-center gap-1">
            <iconify-icon icon="lucide:clock-3" class="text-sm"></iconify-icon>
            Now
          </button>
        </div>
      </div>

      <!-- Stats inline -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div class="neu-inset rounded-[16px] px-4 py-2.5">
          <p class="font-dm text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Current</p>
          <p id="timeline-current-val" class="font-mono font-bold text-base text-fg mt-0.5 tabular-nums" style="color: var(--rage-current-color)">--</p>
        </div>
        <div class="neu-inset rounded-[16px] px-4 py-2.5">
          <p class="font-dm text-[9px] font-bold uppercase tracking-[0.12em] text-muted">60s Avg</p>
          <p id="timeline-avg-val" class="font-mono font-bold text-base text-fg mt-0.5 tabular-nums">--</p>
        </div>
        <div class="neu-inset rounded-[16px] px-4 py-2.5">
          <p class="font-dm text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Volatility</p>
          <p id="timeline-volatility-val" class="font-mono font-bold text-base text-fg mt-0.5 tabular-nums">--</p>
        </div>
      </div>

      <!-- Chart well -->
      <div class="neu-inset-deep rounded-[20px] p-3">
        <div class="relative h-[160px] sm:h-[180px] lg:h-[180px] xl:h-[200px]">
          <canvas id="timeline-canvas"></canvas>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex items-center justify-between mt-3 flex-wrap gap-2">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-1.5 rounded-full" style="background: var(--rage-current-color)"></span>
            <span class="font-dm text-xs text-muted font-medium">Rage Score</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-muted">···</span>
            <span class="font-dm text-xs text-muted font-medium">Threshold (60)</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 neu-inset-sm rounded-full px-3 py-1">
          <iconify-icon icon="lucide:activity" class="text-xs" style="color: var(--rage-current-color)"></iconify-icon>
          <span id="timeline-frequency-val" class="font-mono text-[11px] text-fg font-bold">-- events/s</span>
        </div>
      </div>
    `;
    main.appendChild(timelinePanel);

    // Session Insights
    const sessionInsights = document.createElement('section');
    sessionInsights.className = 'neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel flex-1 min-h-0 flex flex-col justify-between';
    sessionInsights.setAttribute('aria-label', 'Session statistics');
    sessionInsights.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="font-jakarta font-bold text-base text-fg tracking-tight">Session Insights</h2>
          <p id="insights-duration-subtitle" class="font-dm text-xs text-muted mt-0.5">Aggregated from 0s of tracking</p>
        </div>
        <div class="flex items-center gap-1.5 neu-inset-sm rounded-full px-3 py-1">
          <iconify-icon icon="lucide:bar-chart-3" class="text-xs text-muted"></iconify-icon>
          <span id="insights-duration-badge" class="font-dm text-[10px] font-bold uppercase tracking-wider text-muted">0 min</span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 flex-1 min-h-0">
        <!-- Avg Rage -->
        <div class="neu-inset rounded-[20px] p-3 lg:p-4 relative flex flex-col justify-center">
          <div class="flex items-center gap-2 mb-2">
            <div class="neu-inset-sm rounded-[10px] w-8 h-8 flex items-center justify-center">
              <iconify-icon icon="lucide:gauge" class="text-muted text-sm"></iconify-icon>
            </div>
            <span class="font-dm text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Avg Rage</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span id="stat-avg-value" class="font-mono font-bold text-2xl md:text-3xl text-fg tabular-nums">--</span>
            <span class="font-mono text-sm text-muted">/100</span>
          </div>
          <div id="stat-avg-label" class="mt-2 flex items-center gap-1.5">
            <span class="font-dm text-[10px] text-muted">--</span>
          </div>
        </div>

        <!-- Max Rage -->
        <div class="neu-inset rounded-[20px] p-3 lg:p-4 relative flex flex-col justify-center">
          <div class="flex items-center gap-2 mb-2">
            <div class="neu-inset-sm rounded-[10px] w-8 h-8 flex items-center justify-center">
              <iconify-icon icon="lucide:flame" class="text-sm" style="color: var(--rage-current-color)"></iconify-icon>
            </div>
            <span class="font-dm text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Max Rage</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span id="stat-max-value" class="font-mono font-bold text-2xl md:text-3xl tabular-nums" style="color: var(--rage-current-color)">--</span>
            <span class="font-mono text-sm text-muted">peak</span>
          </div>
          <div id="stat-max-label" class="mt-2 flex items-center gap-1.5">
            <iconify-icon icon="lucide:zap" class="text-sm" style="color: var(--rage-current-color)"></iconify-icon>
            <span class="font-mono text-xs font-bold text-fg">--</span>
          </div>
        </div>

        <!-- Spikes -->
        <div class="neu-inset rounded-[20px] p-3 lg:p-4 relative flex flex-col justify-center">
          <div class="flex items-center gap-2 mb-2">
            <div class="neu-inset-sm rounded-[10px] w-8 h-8 flex items-center justify-center">
              <iconify-icon icon="lucide:zap" class="text-muted text-sm"></iconify-icon>
            </div>
            <span class="font-dm text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Spikes</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span id="stat-spikes-value" class="font-mono font-bold text-2xl md:text-3xl text-fg tabular-nums">--</span>
            <span class="font-mono text-sm text-muted">events</span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <div class="flex-1 h-1.5 neu-inset-sm rounded-full overflow-hidden">
              <div id="stat-spikes-bar" class="histo-bar h-full rounded-full" style="width: 0%; background: var(--rage-current-color);"></div>
            </div>
            <span id="stat-spikes-label" class="font-mono text-xs text-fg font-bold">0% high</span>
          </div>
        </div>
      </div>

      <!-- Mini histogram -->
      <div class="mt-3 lg:mt-4 neu-inset rounded-[16px] p-3 lg:p-4 flex-shrink-0">
        <div class="flex items-center justify-between mb-2">
          <span class="font-dm text-[10px] font-bold uppercase tracking-wider text-muted">Rage distribution · last 5 min</span>
          <span class="font-mono text-[11px] text-muted">30s buckets</span>
        </div>
        <div class="flex items-end gap-1.5 h-12 lg:h-14" id="insights-histogram">
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #22c55e"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #84cc16"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #eab308"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #f97316"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #eab308"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #f97316"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #84cc16"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #f97316"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #ef4444"></div>
          <div class="histo-bar flex-1 rounded-t-md" style="height: 0%; background: #eab308"></div>
        </div>
      </div>
    `;
    main.appendChild(sessionInsights);

    grid.appendChild(main);

    // ── Right Panel (Alert Log + Device Status) ──────────
    const right = document.createElement('aside');
    right.className = 'flex flex-col lg:col-span-full 2xl:col-span-1 min-w-0 lg:h-full lg:overflow-visible gap-3 lg:gap-4';
    right.setAttribute('aria-label', 'Right panel');

    // Alert Log
    const alertLog = document.createElement('section');
    alertLog.className = 'alert-log neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel flex-1 min-h-0 flex flex-col';
    alertLog.setAttribute('aria-label', 'Alert log');
    alertLog.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <h2 class="font-jakarta font-bold text-base text-fg tracking-tight">Alert Log</h2>
          <span class="neu-inset-sm rounded-full px-2 py-0.5">
            <span id="alert-count" class="font-mono text-[11px] font-bold text-muted">0</span>
          </span>
        </div>
        <button id="clear-alerts-btn" class="neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Clear alerts">
          <iconify-icon icon="lucide:trash-2" class="text-muted text-sm"></iconify-icon>
        </button>
      </div>

      <div id="alert-list" class="neu-inset-deep rounded-[16px] p-2 overflow-y-auto neu-scroll flex-1 min-h-[100px] space-y-2">
        <div class="alert-log__empty text-xs text-muted p-4 text-center">No alerts yet. Start a session to begin monitoring.</div>
      </div>

      <button id="alert-view-history" class="mt-3 w-full neu-inset rounded-[12px] py-2.5 font-dm text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] transition-all neu-btn">
        <iconify-icon icon="lucide:list" class="text-sm"></iconify-icon>
        View full history
      </button>
    `;
    right.appendChild(alertLog);

    // Status Bar
    const statusBar = document.createElement('section');
    statusBar.className = 'neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel flex-shrink-0';
    statusBar.setAttribute('aria-label', 'Device status');
    statusBar.innerHTML = `
      <h2 class="font-jakarta font-bold text-base text-fg tracking-tight mb-3">Device Status</h2>
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center gap-3">
          <div class="neu-extruded-sm rounded-[10px] w-8 h-8 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="lucide:camera" class="text-muted text-base"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-dm text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Camera</p>
            <p class="font-dm text-xs font-medium text-fg truncate" id="cam-status-name">None</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span id="cam-status-dot" class="status-inactive w-2 h-2 rounded-full"></span>
            <span id="cam-status-text" class="font-dm text-[9px] font-bold uppercase text-muted">Inactive</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="neu-extruded-sm rounded-[10px] w-8 h-8 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="lucide:mic" class="text-muted text-base"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-dm text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Microphone</p>
            <p class="font-dm text-xs font-medium text-fg truncate" id="mic-status-name">None</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span id="mic-status-dot" class="status-inactive w-2 h-2 rounded-full"></span>
            <span id="mic-status-text" class="font-dm text-[9px] font-bold uppercase text-muted">Inactive</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="neu-extruded-sm rounded-[10px] w-8 h-8 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="lucide:cpu" class="text-muted text-base"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-dm text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Inference</p>
            <p class="font-dm text-xs font-medium text-fg">WebGPU · local</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="status-active w-2 h-2 rounded-full"></span>
            <span class="font-dm text-[9px] font-bold uppercase text-teal">Fast</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="neu-extruded-sm rounded-[10px] w-8 h-8 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="lucide:wifi" class="text-muted text-base"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-dm text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Network</p>
            <p class="font-dm text-xs font-medium text-fg">Offline mode</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="w-2 h-2 rounded-full bg-[#A0AEC0]"></span>
            <span class="font-dm text-[9px] font-bold uppercase text-muted">Local</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="neu-inset-sm rounded-[10px] w-8 h-8 flex items-center justify-center flex-shrink-0">
            <iconify-icon icon="lucide:gamepad-2" class="text-muted text-base"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-dm text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Game Hook</p>
            <p class="font-dm text-xs font-medium text-fg">Universal</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span id="gamehook-status-dot" class="live-dot w-2 h-2 rounded-full"></span>
            <span id="gamehook-status-text" class="font-dm text-[9px] font-bold uppercase" style="color: var(--rage-current-color)">Synced</span>
          </div>
        </div>
      </div>
    `;
    right.appendChild(statusBar);

    grid.appendChild(right);
    wrapper.appendChild(grid);

    // ── Footer Session Controls ──────────────────────────
    const footer = document.createElement('footer');
    footer.id = 'controls-container';
    wrapper.appendChild(footer);

    app.appendChild(wrapper);

    // ── Screen reader announcer ─────────────────────────
    const announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.className = 'sr-only';
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);

    // ── Instantiate UI components ───────────────────────
    this._meter = new RageMeter(document.getElementById('meter-container'));
    this._timeline = new SessionTimeline(document.getElementById('timeline-canvas'));
    this._toasts = new ToastManager();
    this._settingsPanel = new SettingsPanel();
    this._controls = new SessionControls(document.getElementById('controls-container'), {
      onStart: () => this._onSessionStart(),
      onPause: () => this._onSessionPause(),
      onResume: () => this._onSessionResume(),
      onStop: () => this._onSessionStop(),
      onHistory: () => this._onSessionHistory(),
    });
    this._webcamPreview = new WebcamPreview(document.getElementById('webcam-container'));
    this._sessionHistory = new SessionHistory(this._sessionManager);
    this._summaryModal = new SessionSummaryModal(this._sessionManager);

    // Analytics
    this._analyticsEngine = new AnalyticsEngine(this._sessionManager);
    this._analyticsDashboard = new AnalyticsDashboard(this._analyticsEngine);
    document.getElementById('btn-analytics')?.addEventListener('click', () => this._onOpenAnalytics());

    // Cooldown system
    const settings = loadSettings();
    this._cooldownEngine = new CooldownEngine(settings.cooldown || {});
    this._breathingOverlay = new BreathingOverlay();
    this._breakReminder = new BreakReminder({
      onTakeBreak: () => this._startBreathingExercise(),
      onSnooze: () => {},
      onDismiss: () => this._cooldownEngine.recordDismissal('break'),
    });

    // Wire cooldown suggestions
    eventBus.on('cooldown:suggestion', (data) => this._handleCooldownSuggestion(data));

    // Alert view history button wiring
    const alertHistoryBtn = document.getElementById('alert-view-history');
    if (alertHistoryBtn) {
      alertHistoryBtn.addEventListener('click', () => this._onSessionHistory());
    }

    // Mobile Menu
    this._mobileMenu = new MobileMenu({
      onHistory: () => this._onSessionHistory(),
      onSettings: () => this._settingsPanel.open(),
    });

    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        this._mobileMenu.open();
      });
    }

    // Settings button in header
    document.getElementById('btn-settings').addEventListener('click', () => {
      this._settingsPanel.toggle();
    });

    // Notification bell in header
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
      notificationBtn.addEventListener('click', () => {
        const notifDot = document.getElementById('notif-dot');
        if (notifDot) notifDot.style.display = 'none';

        const alertLog = document.querySelector('.alert-log');
        if (alertLog) {
          alertLog.scrollIntoView({ behavior: 'smooth', block: 'center' });
          alertLog.classList.add('neu-hover');
          setTimeout(() => alertLog.classList.remove('neu-hover'), 1500);
        }
      });
    }
  }

  // ─── Module Initialization ──────────────────────────────

  _initModules() {
    this._camera = new CameraModule({
      detectionFps: this._settings.camera.detectionFps ?? 10,
    });
    this._microphone = new MicrophoneModule({
      noiseGateDB: this._settings.microphone.noiseGateDB ?? -50,
    });
    this._fusion = new FusionEngine({
      faceWeight: this._settings.fusion.faceWeight,
      audioWeight: this._settings.fusion.audioWeight,
      emaAlpha: this._settings.fusion.emaAlpha,
      momentumDecay: this._settings.fusion.momentumDecay,
    });
    this._alerts = new AlertSystem({
      enabled: this._settings.alerts.enabled,
      threshold: this._settings.alerts.threshold,
      cooldownMs: this._settings.alerts.cooldownMs || 30000,
      soundType: this._settings.alerts.soundType || 'beep',
      volume: this._settings.alerts.volume ?? 0.5,
    });
  }

  // ─── Event Subscriptions ────────────────────────────────

  _subscribeEvents() {
    // Camera events → status bar
    this._unsubCamStarted = eventBus.on('camera:started', (data) => {
      this._updateCamStatus('active', data?.label);
    });
    this._unsubCamStopped = eventBus.on('camera:stopped', () => {
      this._updateCamStatus('inactive');
    });
    this._unsubCamError = eventBus.on('camera:error', ({ error, errorName }) => {
      this._updateCamStatus('error');
      this._announce(`Camera error: ${error}`);
      console.error('Camera error:', error);

      const guidance = {
        NotAllowedError: 'Camera permission was denied. Click the lock icon in your browser\'s address bar to allow camera access, then try again.',
        NotFoundError: 'No camera detected. Please connect a webcam and refresh the page.',
        NotReadableError: 'Camera is in use by another application. Close other apps using the camera and try again.',
      };
      this._toasts.showError({
        title: 'Camera Unavailable',
        message: guidance[errorName] || `Camera error: ${error}. Check your device and try again.`,
        errorName,
      });
    });

    // Mic events → status bar
    this._unsubMicStarted = eventBus.on('mic:started', (data) => {
      this._updateMicStatus('active', data?.label);
    });
    this._unsubMicStopped = eventBus.on('mic:stopped', () => {
      this._updateMicStatus('inactive');
    });
    this._unsubMicError = eventBus.on('mic:error', ({ error, errorName }) => {
      this._updateMicStatus('error');
      this._announce(`Microphone error: ${error}`);
      console.error('Microphone error:', error);

      const guidance = {
        NotAllowedError: 'Microphone permission was denied. Click the lock icon in your browser\'s address bar to allow mic access, then try again.',
        NotFoundError: 'No microphone detected. Please connect a microphone and refresh the page.',
        NotReadableError: 'Microphone is in use by another application. Close other apps using the mic and try again.',
      };
      this._toasts.showError({
        title: 'Microphone Unavailable',
        message: guidance[errorName] || `Microphone error: ${error}. Check your device and try again.`,
        errorName,
      });
    });

    // Fusion score → update stats and timeline live badge
    this._unsubFusion = eventBus.on('fusion:score', (score) => {
      this._updateRageTokens(score);
      this._announceRageLevel(score);
      if (this._isActive) {
        this._sessionDataPoints.push(score);
      }

      // Update inline stats in the timeline panel
      const currentVal = document.getElementById('timeline-current-val');
      if (currentVal) {
        currentVal.textContent = Math.round(score.smoothed);
        currentVal.style.color = 'var(--rage-current-color)';
      }

      // Update 60s Avg
      const avgVal = document.getElementById('timeline-avg-val');
      if (avgVal && this._sessionDataPoints.length > 0) {
        const scores = this._sessionDataPoints.map(p => p.smoothed);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        avgVal.textContent = Math.round(avg);
      }

      // Update Volatility (standard deviation of rolling window)
      const volatilityVal = document.getElementById('timeline-volatility-val');
      if (volatilityVal && this._sessionDataPoints.length > 1) {
        const scores = this._sessionDataPoints.map(p => p.smoothed);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const squareDiffs = scores.map(s => Math.pow(s - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
        const stdDev = Math.sqrt(avgSquareDiff);
        volatilityVal.textContent = (Math.round(stdDev * 10) / 10).toFixed(1);
      } else if (volatilityVal) {
        volatilityVal.textContent = '0.0';
      }

      // Update events frequency
      const frequencyVal = document.getElementById('timeline-frequency-val');
      if (frequencyVal) {
        const now = Date.now();
        const recentPoints = this._sessionDataPoints.filter(p => now - p.timestamp < 5000);
        const fps = recentPoints.length / 5;
        frequencyVal.textContent = (Math.round(fps * 10) / 10).toFixed(1) + ' events/s';
      }
    });

    // Session lifecycle → UI state
    this._unsubSessStarted = eventBus.on('session:started', () => {
      this._isActive = true;
      this._sessionDataPoints = [];
      this._updateLiveBadge('LIVE');
      this._startTimer();
    });
    this._unsubSessPaused = eventBus.on('session:paused', () => {
      this._stopTimer();
      this._updateLiveBadge('PAUSED');
    });
    this._unsubSessResumed = eventBus.on('session:resumed', () => {
      this._startTimer();
      this._updateLiveBadge('LIVE');
    });
    this._unsubSessStopped = eventBus.on('session:stopped', async (data) => {
      this._isActive = false;
      this._stopTimer();
      this._elapsedSeconds = 0;
      this._resetTimerDisplay();
      this._updateLiveBadge('WAITING');
      this._updateStats(data.stats);
      this._sessionDataPoints = [];
      await this._loadLastSessionStats();
    });

    // Alert triggered → add to alert log
    this._unsubAlert = eventBus.on('alert:triggered', (alertData) => {
      this._addAlertLogEntry(alertData);
      const notifDot = document.getElementById('notif-dot');
      if (notifDot) notifDot.style.display = 'block';
    });

    // Settings changed → propagate to modules
    this._unsubSettings = eventBus.on('settings:changed', (settings) => {
      this._applySettings(settings);
    });
  }

  // ─── Session Lifecycle Handlers ─────────────────────────

  async _onSessionStart() {
    try {
      this._controls.setState('starting');

      // 1. Start session manager FIRST — sets up data collection
      await this._sessionManager.start();
      const session = this._sessionManager.currentSession;
      if (session) {
        this._controls.setSessionId(session.id);
      }
      this._isActive = true;
      this._sessionStartTime = Date.now();
      this._elapsedSeconds = 0;
      this._sessionDataPoints = [];
      this._clearAlertLog();

      // 2. Start microphone
      await this._microphone.start();

      // 3. Start camera with model loading
      const videoEl = this._webcamPreview.getVideoElement();
      await this._camera.start(videoEl);

      eventBus.emit('app:session-active', true);

      // Start cooldown monitoring
      if (this._cooldownEngine) {
        this._cooldownEngine.start();
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      this._isActive = false;
      this._sessionManager.stop().catch(() => {});
      this._controls.setState('idle');
      this._announce(`Session failed: ${err.message}`);
    }
  }

  async _onSessionPause() {
    if (this._sessionManager.currentSession?.status === 'active') {
      this._sessionManager.pause();
      this._camera.pause();
      this._microphone.pause();
      this._timerRunning = false;
    }
  }

  async _onSessionResume() {
    if (this._sessionManager.currentSession?.status === 'paused') {
      this._sessionManager.resume();
      this._camera.resume();
      this._microphone.resume();
      this._timerRunning = true;
    }
  }

  async _onSessionStop() {
    try {
      this._controls.setState('stopping');
      this._camera.stop();
      this._microphone.stop();
      const completedSession = await this._sessionManager.stop();
      this._isActive = false;

      // Stop cooldown monitoring
      if (this._cooldownEngine) {
        this._cooldownEngine.stop();
      }

      this._announce('Session stopped.');

      if (completedSession) {
        const choice = await this._summaryModal.show(completedSession);
        if (choice === 'discard') {
          await this._loadLastSessionStats();
          this._announce('Session discarded.');
        } else {
          this._announce('Session saved.');
        }
      }
    } catch (err) {
      console.error('Failed to stop session:', err);
      this._controls.setState('idle');
    }
  }

  _onSessionHistory() {
    this._announce('Opening session history...');
    if (this._sessionHistory) {
      this._sessionHistory.open();
    }
  }

  _onOpenAnalytics() {
    this._announce('Opening analytics dashboard...');
    if (this._analyticsDashboard) {
      this._analyticsDashboard.open();
    }
  }

  _handleCooldownSuggestion(data) {
    if (data.type === 'breathing') {
      if (this._cooldownEngine._config.autoShow) {
        this._startBreathingExercise();
      } else {
        this._breakReminder.show('Your rage has been high for a while. Try a breathing exercise.');
      }
    } else if (data.type === 'break') {
      this._breakReminder.show('Consider taking a short break to reset.');
    } else {
      this._breakReminder.show(data.message || 'Take a moment to relax.');
    }
  }

  async _startBreathingExercise() {
    if (!this._breathingOverlay) return;
    this._breakReminder.dismiss();
    const technique = this._cooldownEngine?._config?.technique || '4-7-8';
    this._cooldownEngine?.recordStart('breathing');

    const result = await this._breathingOverlay.show({ technique, rounds: 4 });

    // Get current rage score for effectiveness tracking
    const currentScore = this._fusion?.lastScore?.smoothed || 0;
    if (result.completed) {
      this._cooldownEngine?.recordCompletion('breathing', currentScore);
      this._toasts?.showSuccess?.('Breathing exercise complete! 🧘') ||
        this._announce('Breathing exercise complete!');
    } else {
      this._cooldownEngine?.recordDismissal('breathing');
    }
  }

  // ─── Timer ──────────────────────────────────────────────

  _startTimer() {
    this._timerRunning = true;
    this._sessionStartTime = Date.now() - (this._elapsedSeconds * 1000);

    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      if (!this._timerRunning) return;
      this._elapsedSeconds = Math.floor((Date.now() - this._sessionStartTime) / 1000);
      this._updateTimerDisplay();

      // Periodic stats update
      if (this._elapsedSeconds % 2 === 0) {
        this._recalculateStats();
      }
    }, TIMER_INTERVAL_MS);
  }

  _stopTimer() {
    this._timerRunning = false;
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _updateTimerDisplay() {
    const timerEl = document.getElementById('session-timer');
    const timerMobileEl = document.getElementById('session-timer-mobile');
    if (!timerEl) return;

    const m = Math.floor(this._elapsedSeconds / 60);
    const s = this._elapsedSeconds % 60;
    const h = Math.floor(m / 60);
    const displayM = m % 60;

    const pad = (num) => String(num).padStart(2, '0');
    const timeStr = h > 0
      ? `${pad(h)}:${pad(displayM)}:${pad(s)}`
      : `${pad(displayM)}:${pad(s)}`;

    timerEl.textContent = timeStr;
    if (timerMobileEl) timerMobileEl.textContent = timeStr;
    timerEl.setAttribute('aria-label', `Session duration: ${h > 0 ? `${h} hours ` : ''}${displayM} minutes and ${s} seconds`);

    // Update Session Insights duration details
    const subtitle = document.getElementById('insights-duration-subtitle');
    if (subtitle) {
      const durationParts = [];
      if (h > 0) durationParts.push(`${h}h`);
      if (displayM > 0 || h > 0) durationParts.push(`${displayM}m`);
      durationParts.push(`${s}s`);
      subtitle.textContent = `Aggregated from ${durationParts.join(' ')} of tracking`;
    }

    const badge = document.getElementById('insights-duration-badge');
    if (badge) {
      const minVal = Math.max(1, Math.round(this._elapsedSeconds / 60));
      badge.textContent = `${minVal} min`;
    }
  }

  _resetTimerDisplay() {
    const timerEl = document.getElementById('session-timer');
    if (timerEl) {
      timerEl.textContent = '00:00';
      timerEl.setAttribute('aria-label', 'Session duration: 0 minutes and 0 seconds');
    }
  }

  // ─── Stats ──────────────────────────────────────────────

  _recalculateStats() {
    if (this._sessionDataPoints.length === 0) return;

    const scores = this._sessionDataPoints.map(p => p.smoothed);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const spikes = scores.filter(s => s >= 80).length;

    let maxTime = null;
    let maxVal = -1;
    this._sessionDataPoints.forEach(p => {
      if (p.smoothed > maxVal) {
        maxVal = p.smoothed;
        maxTime = p.timestamp;
      }
    });

    const histogram = Array(10).fill(0);
    this._sessionDataPoints.forEach(p => {
      const bin = Math.min(9, Math.floor(p.smoothed / 10));
      histogram[bin]++;
    });

    this._updateStats({
      avg: Math.round(avg * 10) / 10,
      max: Math.round(max * 10) / 10,
      spikes,
      spikesPercent: Math.round((spikes / scores.length) * 100),
      maxTime,
      histogram,
    });
  }

  _updateStats(stats) {
    const avgVal = document.getElementById('stat-avg-value');
    const avgLabel = document.getElementById('stat-avg-label');
    const maxVal = document.getElementById('stat-max-value');
    const maxLabel = document.getElementById('stat-max-label');
    const spikesVal = document.getElementById('stat-spikes-value');

    if (avgVal) {
      avgVal.textContent = stats.avg != null ? Math.round(stats.avg) : '--';
    }
    if (avgLabel) {
      let trendHTML = '';
      if (this._lastSessionStats && this._lastSessionStats.avg > 0) {
        const diff = stats.avg - this._lastSessionStats.avg;
        const percent = Math.round((Math.abs(diff) / this._lastSessionStats.avg) * 100);
        if (diff > 0) {
          trendHTML = ` <span style="color:var(--error);font-weight:bold;margin-left:4px">▲ +${percent}%</span>`;
        } else if (diff < 0) {
          trendHTML = ` <span style="color:var(--teal);font-weight:bold;margin-left:4px">▼ -${percent}%</span>`;
        } else {
          trendHTML = ` <span style="color:var(--muted);margin-left:4px">■ 0%</span>`;
        }
      }
      const lvl = stats.avg != null ? getRageLevel(stats.avg).name : '--';
      avgLabel.innerHTML = lvl.toUpperCase() + trendHTML;
    }
    if (maxVal) {
      maxVal.textContent = stats.max != null ? Math.round(stats.max) : '--';
    }
    if (maxLabel) {
      let timeStr = '--';
      if (stats.maxTime) {
        const d = new Date(stats.maxTime);
        timeStr = d.toTimeString().split(' ')[0];
      }
      maxLabel.textContent = `Peak at ${timeStr}`;
    }
    if (spikesVal) {
      spikesVal.textContent = stats.spikes != null ? stats.spikes : '--';
    }
    const spikesLabel = document.getElementById('stat-spikes-label');
    if (spikesLabel) {
      spikesLabel.textContent = `${stats.spikesPercent ?? 0}% high`;
    }
    const spikesBar = document.getElementById('stat-spikes-bar');
    if (spikesBar) {
      spikesBar.style.width = `${stats.spikesPercent ?? 0}%`;
    }

    if (stats.histogram) {
      const maxCount = Math.max(...stats.histogram);
      const bars = document.querySelectorAll('#insights-histogram .histo-bar');
      if (bars.length === 10) {
        stats.histogram.forEach((count, idx) => {
          const height = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
          bars[idx].style.height = `${height}%`;
          bars[idx].setAttribute('title', `${count} samples`);
        });
      }
    }
  }

  async _loadLastSessionStats() {
    try {
      const sessions = await this._sessionManager.getAllSessions();
      const completedSessions = sessions.filter(s => s.status === 'completed' && s.id !== this._sessionManager.currentSession?.id);
      if (completedSessions.length > 0) {
        completedSessions.sort((a, b) => b.startedAt - a.startedAt);
        this._lastSessionStats = completedSessions[0].stats;
      } else {
        this._lastSessionStats = null;
      }
    } catch (err) {
      console.error('Failed to load last session stats:', err);
      this._lastSessionStats = null;
    }
  }

  // ─── Status Bar ─────────────────────────────────────────

  _updateMicStatus(status, label = '') {
    const dot = document.getElementById('mic-status-dot');
    const text = document.getElementById('mic-status-text');
    const name = document.getElementById('mic-status-name');
    if (!dot || !text) return;

    dot.className = 'status-bar__dot';
    const labels = { active: 'Active', inactive: 'Inactive', error: 'Error' };
    if (status === 'active') {
      dot.classList.add('status-bar__dot--active');
      if (name) name.textContent = label || 'Microphone';
    } else if (status === 'error') {
      dot.classList.add('status-bar__dot--error');
      if (name) name.textContent = 'None';
    } else {
      dot.classList.add('status-bar__dot--inactive');
      if (name) name.textContent = 'None';
    }
    text.textContent = labels[status] || 'Inactive';
  }

  _updateCamStatus(status, label = '') {
    const dot = document.getElementById('cam-status-dot');
    const text = document.getElementById('cam-status-text');
    const name = document.getElementById('cam-status-name');
    if (!dot || !text) return;

    dot.className = 'status-bar__dot';
    const labels = { active: 'Active', inactive: 'Inactive', error: 'Error' };
    if (status === 'active') {
      dot.classList.add('status-bar__dot--active');
      if (name) name.textContent = label || 'Camera';
    } else if (status === 'error') {
      dot.classList.add('status-bar__dot--error');
      if (name) name.textContent = 'None';
    } else {
      dot.classList.add('status-bar__dot--inactive');
      if (name) name.textContent = 'None';
    }
    text.textContent = labels[status] || 'Inactive';
  }

  _updateLiveBadge(text) {
    const badge = document.getElementById('timeline-live-badge');
    if (badge) badge.textContent = text;
  }

  // ─── Alert Log ──────────────────────────────────────────

  _addAlertLogEntry(alertData) {
    const list = document.getElementById('alert-list');
    const countEl = document.getElementById('alert-count');
    if (!list) return;

    // Remove empty state
    const empty = list.querySelector('.alert-log__empty');
    if (empty) empty.remove();

    const time = alertData.timestamp
      ? new Date(alertData.timestamp).toLocaleTimeString('en-US', { hour12: false })
      : '';

    const item = document.createElement('div');
    item.className = `alert-log__item alert-log__item--${alertData.level || 'calm'}`;
    item.innerHTML = `
      <span class="alert-log__item-icon">${alertData.emoji || '⚠️'}</span>
      <span class="alert-log__item-time">${time}</span>
      <span class="alert-log__item-message">${alertData.message || ''}</span>
      <span class="alert-log__item-score">${Math.round(alertData.score)}</span>
    `;
    list.appendChild(item);

    // Keep max ~50 entries
    while (list.children.length > 50) {
      list.firstChild.remove();
    }

    // Scroll to bottom
    list.scrollTop = list.scrollHeight;

    // Update count
    const visible = list.querySelectorAll('.alert-log__item').length;
    if (countEl) countEl.textContent = visible;
  }

  _clearAlertLog() {
    const list = document.getElementById('alert-list');
    const countEl = document.getElementById('alert-count');
    if (list) {
      list.innerHTML = '<div class="alert-log__empty">No alerts yet. Start a session to begin monitoring.</div>';
    }
    if (countEl) countEl.textContent = '0';
  }

  // ─── Rage CSS Tokens ────────────────────────────────────

  _updateRageTokens(score) {
    const level = getRageLevel(score.smoothed);
    const root = document.documentElement;
    root.style.setProperty('--rage-current-color', level.color);
    root.style.setProperty('--rage-current-glow', level.glow);
    root.style.setProperty('--glow-pulse-duration', level.pulseDuration);
  }

  // ─── Accessibility Announcements ────────────────────────

  _announceRageLevel(score) {
    const level = getRageLevel(score.smoothed);
    const now = Date.now();

    // Only announce on level change, with cooldown
    if (level.name === this._lastAnnouncedLevel) return;
    if (now - this._lastAnnounceTime < RAGE_ANNOUNCE_COOLDOWN_MS) return;

    this._lastAnnouncedLevel = level.name;
    this._lastAnnounceTime = now;

    this._announce(`Rage level changed to ${level.name}, ${Math.round(score.smoothed)} percent.`);
  }

  _announce(message) {
    const el = document.getElementById('sr-announcer');
    if (el) {
      el.textContent = '';
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }
  }

  // ─── Settings Application ───────────────────────────────

  _applySettings(settings) {
    this._settings = settings;

    // Update camera module
    if (this._camera) {
      this._camera.detectionFps = settings.camera.detectionFps ?? 10;
    }

    // Update microphone module
    if (this._microphone) {
      this._microphone.noiseGateDB = settings.microphone.noiseGateDB ?? -50;
    }

    // Update fusion engine
    if (this._fusion) {
      this._fusion.updateConfig({
        faceWeight: settings.fusion.faceWeight,
        audioWeight: settings.fusion.audioWeight,
        emaAlpha: settings.fusion.emaAlpha,
        momentumDecay: settings.fusion.momentumDecay,
      });
    }

    // Update alert system
    if (this._alerts) {
      this._alerts.updateConfig({
        enabled: settings.alerts.enabled,
        threshold: settings.alerts.threshold,
        cooldownMs: settings.alerts.cooldownMs || 30000,
        soundType: settings.alerts.soundType || 'beep',
        volume: settings.alerts.volume ?? 0.5,
      });
    }

    // Camera preview overlay visibility
    const showOverlay = settings.camera.showOverlay !== false;
    const overlay = document.querySelector('.webcam-preview__overlay');
    if (overlay) {
      overlay.style.display = showOverlay ? 'block' : 'none';
    }

    this._settingsApplied = true;
  }

  // ─── Keyboard Shortcuts ─────────────────────────────────

  _bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when user is typing in an input
      if (e.target.matches('input, select, textarea, [contenteditable]')) return;

      switch (e.key) {
        case 's':
        case 'S':
          e.preventDefault();
          if (this._controls.getState() === 'idle' || this._controls.getState() === 'paused') {
            this._onSessionStart();
          } else if (this._controls.getState() === 'active') {
            this._onSessionStop();
          }
          break;

        case 'p':
        case 'P':
          e.preventDefault();
          if (this._controls.getState() === 'active' || this._controls.getState() === 'paused') {
            this._onSessionPause();
          }
          break;

        case ',':
          e.preventDefault();
          this._settingsPanel.toggle();
          break;

        case 'Escape':
          if (this._settingsPanel._isOpen) {
            this._settingsPanel.close();
          }
          break;

        default:
          break;
      }
    });
  }

  // ─── Cleanup ─────────────────────────────────────────────

  destroy() {
    this._stopTimer();
    this._camera?.stop();
    this._microphone?.stop();
    this._fusion?.destroy();
    this._alerts?.destroy();

    this._unsubCamStarted?.();
    this._unsubCamStopped?.();
    this._unsubCamError?.();
    this._unsubMicStarted?.();
    this._unsubMicStopped?.();
    this._unsubMicError?.();
    this._unsubFusion?.();
    this._unsubSessStarted?.();
    this._unsubSessPaused?.();
    this._unsubSessResumed?.();
    this._unsubSessStopped?.();
    this._unsubAlert?.();
    this._unsubSettings?.();

    this._meter?.destroy();
    this._timeline?.destroy();
    this._toasts?.destroy();
    this._settingsPanel?.destroy();
    this._webcamPreview?.destroy();
    this._controls?.destroy();
  }
}

// ─── Boot ──────────────────────────────────────────────────

const app = new RageRadarApp();
app.init().catch((err) => {
  console.error('RageRadar failed to initialize:', err);
});

// Expose for dev console
window.__app = app;
