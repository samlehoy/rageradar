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

    // Auto-open settings if first visit?
    // Just render and wait.
    eventBus.emit('app:ready');
  }

  // ─── Render Dashboard Layout ────────────────────────────

  _renderDashboard() {
    const app = document.querySelector('#app');
    app.innerHTML = '';

    // Create dashboard container
    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';
    dashboard.setAttribute('role', 'main');
    dashboard.setAttribute('aria-label', 'RageRadar dashboard');

    // ── Header ──────────────────────────────────────────
    const header = document.createElement('header');
    header.className = 'dashboard-header';
    header.setAttribute('role', 'banner');
    header.innerHTML = `
      <div class="dashboard-header__brand">
        <span class="dashboard-header__logo">
          Rage<span class="dashboard-header__logo-accent">Radar</span>
        </span>
        <span class="dashboard-header__timer">
          <span class="dashboard-header__timer-label">Session</span>
          <time id="session-timer" aria-live="off" aria-label="Session duration">00:00</time>
        </span>
      </div>
      <div class="dashboard-header__actions">
        <button id="btn-settings" class="btn btn--ghost" aria-label="Open settings" title="Settings (Comma)">
          <span class="btn__icon">${SVG_SETTINGS}</span>
        </button>
      </div>
    `;

    // ── Sidebar ─────────────────────────────────────────
    const sidebar = document.createElement('aside');
    sidebar.className = 'dashboard-sidebar';
    sidebar.setAttribute('aria-label', 'Monitoring panel');

    const meterContainer = document.createElement('div');
    meterContainer.id = 'meter-container';
    sidebar.appendChild(meterContainer);

    const webcamContainer = document.createElement('div');
    webcamContainer.id = 'webcam-container';
    sidebar.appendChild(webcamContainer);

    // ── Main ────────────────────────────────────────────
    const main = document.createElement('div');
    main.className = 'dashboard-main';

    // Timeline panel
    const timelinePanel = document.createElement('div');
    timelinePanel.className = 'timeline-panel';
    timelinePanel.innerHTML = `
      <div class="timeline-header">
        <h2 class="timeline-title">Rage Timeline</h2>
        <span class="timeline-stats" id="timeline-live-badge">WAITING</span>
      </div>
      <div class="timeline-chart-wrapper">
        <canvas id="timeline-canvas"></canvas>
      </div>
    `;
    main.appendChild(timelinePanel);

    // Stat cards
    const statCards = document.createElement('div');
    statCards.className = 'stat-cards';
    statCards.setAttribute('aria-label', 'Session statistics');
    statCards.innerHTML = `
      <div class="stat-card" id="stat-avg">
        <span class="stat-card__label">Average</span>
        <span class="stat-card__value" id="stat-avg-value">--</span>
        <span class="stat-card__sub" id="stat-avg-label">--</span>
      </div>
      <div class="stat-card" id="stat-max">
        <span class="stat-card__label">Maximum</span>
        <span class="stat-card__value" id="stat-max-value">--</span>
        <span class="stat-card__sub" id="stat-max-label">--</span>
      </div>
      <div class="stat-card" id="stat-spikes">
        <span class="stat-card__label">Spikes</span>
        <span class="stat-card__value" id="stat-spikes-value">--</span>
        <span class="stat-card__sub" id="stat-spikes-label">&gt;80</span>
      </div>
    `;
    main.appendChild(statCards);

    // ── Right Panel ─────────────────────────────────────
    const right = document.createElement('aside');
    right.className = 'dashboard-right';
    right.setAttribute('aria-label', 'Alerts and status');

    // Alert log
    const alertLog = document.createElement('div');
    alertLog.className = 'alert-log';
    alertLog.innerHTML = `
      <div class="alert-log__header">
        <h3 class="alert-log__title">Alert Log</h3>
        <span class="alert-log__count" id="alert-count">0</span>
      </div>
      <div class="alert-log__list" id="alert-list">
        <div class="alert-log__empty">No alerts yet. Start a session to begin monitoring.</div>
      </div>
    `;
    right.appendChild(alertLog);

    // Status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    statusBar.innerHTML = `
      <div class="status-bar__row">
        <span class="status-bar__row-icon">${SVG_MIC}</span>
        <span class="status-bar__row-label">Mic</span>
        <span class="status-bar__row-value">
          <span class="status-bar__dot status-bar__dot--inactive" id="mic-status-dot"></span>
          <span id="mic-status-text">Inactive</span>
        </span>
      </div>
      <div class="status-bar__row">
        <span class="status-bar__row-icon">${SVG_CAM}</span>
        <span class="status-bar__row-label">Cam</span>
        <span class="status-bar__row-value">
          <span class="status-bar__dot status-bar__dot--inactive" id="cam-status-dot"></span>
          <span id="cam-status-text">Inactive</span>
        </span>
      </div>
    `;
    right.appendChild(statusBar);

    // ── Footer ──────────────────────────────────────────
    const footer = document.createElement('footer');
    footer.className = 'dashboard-footer';
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controls-container';
    footer.appendChild(controlsContainer);

    // Assemble grid
    dashboard.appendChild(header);
    dashboard.appendChild(sidebar);
    dashboard.appendChild(main);
    dashboard.appendChild(right);
    dashboard.appendChild(footer);

    app.appendChild(dashboard);

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
      onStop: () => this._onSessionStop(),
      onHistory: () => this._onSessionHistory(),
    });
    this._webcamPreview = new WebcamPreview(document.getElementById('webcam-container'));

    // Settings button in header
    document.getElementById('btn-settings').addEventListener('click', () => {
      this._settingsPanel.toggle();
    });
  }

  // ─── Module Initialization ──────────────────────────────

  _initModules() {
    this._camera = new CameraModule({
      detectionFps: this._settings.camera.detectionFps || 30,
    });
    this._microphone = new MicrophoneModule();
    this._fusion = new FusionEngine({
      faceWeight: this._settings.fusion.faceWeight,
      audioWeight: this._settings.fusion.audioWeight,
      emaAlpha: this._settings.fusion.emaAlpha,
      momentumDecay: this._settings.fusion.momentumDecay,
    });
    this._alerts = new AlertSystem({
      enabled: this._settings.alerts.enabled,
      threshold: this._settings.alerts.threshold,
      cooldownMs: (this._settings.alerts.cooldownSeconds || 5) * 1000,
      soundType: this._settings.alerts.soundType || 'beep',
      volume: this._settings.alerts.volume ?? 0.5,
    });
  }

  // ─── Event Subscriptions ────────────────────────────────

  _subscribeEvents() {
    // Camera events → status bar
    this._unsubCamStarted = eventBus.on('camera:started', () => {
      this._updateCamStatus('active');
    });
    this._unsubCamStopped = eventBus.on('camera:stopped', () => {
      this._updateCamStatus('inactive');
    });
    this._unsubCamError = eventBus.on('camera:error', () => {
      this._updateCamStatus('error');
    });

    // Mic events → status bar
    this._unsubMicStarted = eventBus.on('mic:started', () => {
      this._updateMicStatus('active');
    });
    this._unsubMicStopped = eventBus.on('mic:stopped', () => {
      this._updateMicStatus('inactive');
    });
    this._unsubMicError = eventBus.on('mic:error', () => {
      this._updateMicStatus('error');
    });

    // Fusion score → update stats and timeline live badge
    this._unsubFusion = eventBus.on('fusion:score', (score) => {
      if (this._isActive) {
        this._sessionDataPoints.push(score);
        this._updateRageTokens(score);
        this._announceRageLevel(score);
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
    this._unsubSessStopped = eventBus.on('session:stopped', (data) => {
      this._isActive = false;
      this._stopTimer();
      this._elapsedSeconds = 0;
      this._resetTimerDisplay();
      this._updateLiveBadge('WAITING');
      this._updateStats(data.stats);
      this._sessionDataPoints = [];
    });

    // Alert triggered → add to alert log
    this._unsubAlert = eventBus.on('alert:triggered', (alertData) => {
      this._addAlertLogEntry(alertData);
    });

    // Settings changed → propagate to modules
    this._unsubSettings = eventBus.on('settings:changed', (settings) => {
      this._applySettings(settings);
    });
  }

  // ─── Session Lifecycle Handlers ─────────────────────────

  async _onSessionStart() {
    try {
      // Update disabled states
      this._controls.setState('starting');

      // Start camera (attaches to webcam video element)
      const videoEl = this._webcamPreview.getVideoElement();
      await this._camera.start(videoEl);

      // Start microphone
      await this._microphone.start();

      // Start fusion (already subscribed via constructor events)
      // No-op: FusionEngine subscribes in constructor

      // Start session manager
      await this._sessionManager.start();

      this._sessionStartTime = Date.now();
      this._elapsedSeconds = 0;
      this._sessionDataPoints = [];

      // Clear alert log for new session
      this._clearAlertLog();

      eventBus.emit('app:session-active', true);
    } catch (err) {
      console.error('Failed to start session:', err);
      this._controls.setState('idle');
      this._announce(`Session failed to start: ${err.message}`);
    }
  }

  async _onSessionPause() {
    if (this._sessionManager.currentSession?.status === 'active') {
      this._sessionManager.pause();
      this._camera.pause();
      this._microphone.pause();
      this._timerRunning = false;
    } else if (this._sessionManager.currentSession?.status === 'paused') {
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
      await this._sessionManager.stop();
      this._isActive = false;

      this._announce('Session stopped.');
    } catch (err) {
      console.error('Failed to stop session:', err);
      this._controls.setState('idle');
    }
  }

  _onSessionHistory() {
    this._announce('Opening session history...');
    // Placeholder — real implementation would show a modal/overlay with past sessions
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
    if (!timerEl) return;

    const m = Math.floor(this._elapsedSeconds / 60);
    const s = this._elapsedSeconds % 60;
    const h = Math.floor(m / 60);
    const displayM = m % 60;

    const text = h > 0
      ? `${String(h).padStart(2, '0')}:${String(displayM).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(displayM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    timerEl.textContent = text;
    timerEl.setAttribute('aria-label', `Session duration: ${h > 0 ? `${h} hours ` : ''}${displayM} minutes and ${s} seconds`);
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

    this._updateStats({
      avg: Math.round(avg * 10) / 10,
      max: Math.round(max * 10) / 10,
      spikes,
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
      const lvl = stats.avg != null ? getRageLevel(stats.avg).name : '--';
      avgLabel.textContent = lvl;
    }
    if (maxVal) {
      maxVal.textContent = stats.max != null ? Math.round(stats.max) : '--';
    }
    if (maxLabel) {
      const lvl = stats.max != null ? getRageLevel(stats.max).name : '--';
      maxLabel.textContent = lvl;
    }
    if (spikesVal) {
      spikesVal.textContent = stats.spikes != null ? stats.spikes : '--';
    }
  }

  // ─── Status Bar ─────────────────────────────────────────

  _updateMicStatus(status) {
    const dot = document.getElementById('mic-status-dot');
    const text = document.getElementById('mic-status-text');
    if (!dot || !text) return;

    dot.className = 'status-bar__dot';
    const labels = { active: 'Active', inactive: 'Inactive', error: 'Error' };
    if (status === 'active') dot.classList.add('status-bar__dot--active');
    else if (status === 'error') dot.classList.add('status-bar__dot--error');
    else dot.classList.add('status-bar__dot--inactive');
    text.textContent = labels[status] || 'Inactive';
  }

  _updateCamStatus(status) {
    const dot = document.getElementById('cam-status-dot');
    const text = document.getElementById('cam-status-text');
    if (!dot || !text) return;

    dot.className = 'status-bar__dot';
    const labels = { active: 'Active', inactive: 'Inactive', error: 'Error' };
    if (status === 'active') dot.classList.add('status-bar__dot--active');
    else if (status === 'error') dot.classList.add('status-bar__dot--error');
    else dot.classList.add('status-bar__dot--inactive');
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
      this._camera.detectionFps = settings.camera.detectionFps || 30;
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
        cooldownMs: (settings.alerts.cooldownSeconds || 5) * 1000,
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
