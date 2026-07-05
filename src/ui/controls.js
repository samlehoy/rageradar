/**
 * Session control buttons component.
 * Start, pause, stop, and history buttons with keyboard shortcuts.
 * Listens to session lifecycle events to update button disabled states.
 */
import { eventBus } from '../utils/event-bus.js';

const SVG_PLAY =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

const SVG_PAUSE =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

const SVG_STOP =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';

const SVG_HISTORY =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

/**
 * @typedef {string} SessionState
 * @value 'idle' | 'starting' | 'active' | 'paused' | 'stopping'
 */

export class SessionControls {
  /**
   * @param {HTMLElement} container - Parent element to render into
   * @param {Object} [callbacks]
   * @param {Function} [callbacks.onStart]
   * @param {Function} [callbacks.onPause]
   * @param {Function} [callbacks.onResume]
   * @param {Function} [callbacks.onStop]
   * @param {Function} [callbacks.onHistory]
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this._state = 'idle';
    this._callbacks = callbacks;

    this._render();
    this._cacheRefs();
    this._bindEvents();
    this._subscribe();

    // Set initial disabled states
    this._updateButtonStates();
  }

  _render() {
    this.container.classList.add('session-controls');
    this.container.setAttribute('role', 'toolbar');
    this.container.setAttribute('aria-label', 'Session controls');

    this.container.innerHTML = `
      <button class="neu-btn" id="ctrl-history" aria-label="View session history" style="border-radius:12px;padding:0 12px;height:40px;font-size:14px;gap:6px">
        <iconify-icon icon="lucide:history" style="font-size:16px"></iconify-icon>
        <span class="btn__label">History</span>
      </button>
      <span class="session-controls__spacer"></span>
      <button class="neu-btn" id="ctrl-pause" disabled aria-label="Pause session" style="border-radius:16px;padding:0 24px;height:48px;font-size:14px;gap:8px">
        <iconify-icon icon="lucide:pause" style="font-size:16px"></iconify-icon>
        <span class="btn__label">Pause</span>
      </button>
      <button class="neu-btn" id="ctrl-stop" disabled aria-label="Stop session" style="border-radius:16px;padding:0 24px;height:48px;font-size:14px;gap:8px">
        <iconify-icon icon="lucide:square" style="font-size:16px"></iconify-icon>
        <span class="btn__label">Stop</span>
      </button>
      <button class="neu-btn-primary" id="ctrl-start" aria-label="Start session" style="border-radius:16px;padding:0 32px;height:48px;font-size:14px;gap:8px">
        <iconify-icon icon="lucide:play" style="font-size:16px"></iconify-icon>
        <span class="btn__label">Start</span>
      </button>
    `;
  }

  _cacheRefs() {
    this._startBtn = this.container.querySelector('#ctrl-start');
    this._pauseBtn = this.container.querySelector('#ctrl-pause');
    this._stopBtn = this.container.querySelector('#ctrl-stop');
    this._historyBtn = this.container.querySelector('#ctrl-history');
  }

  _bindEvents() {
    this._startBtn.addEventListener('click', () => this._handleStart());
    this._pauseBtn.addEventListener('click', () => this._handlePause());
    this._stopBtn.addEventListener('click', () => this._handleStop());
    this._historyBtn.addEventListener('click', () => this._handleHistory());
  }

  _subscribe() {
    this._unsubStarted = eventBus.on('session:started', () => {
      this._setState('active');
    });

    this._unsubPaused = eventBus.on('session:paused', () => {
      this._setState('paused');
    });

    this._unsubResumed = eventBus.on('session:resumed', () => {
      this._setState('active');
    });

    this._unsubStopped = eventBus.on('session:stopped', () => {
      this._setState('idle');
    });
  }

  // ─── State management ──────────────────────────────────

  /**
   * @param {SessionState} newState
   */
  _setState(newState) {
    this._state = newState;
    this._updateButtonStates();
  }

  _updateButtonStates() {
    switch (this._state) {
      case 'idle':
        this._startBtn.disabled = false;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = true;
        this._startBtn.querySelector('.btn__label').textContent = 'Start';
        this._startBtn.querySelector('.btn__icon').innerHTML = SVG_PLAY;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        this._pauseBtn.classList.remove('btn--resume');
        break;

      case 'starting':
        this._startBtn.disabled = true;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = true;
        break;

      case 'active':
        this._startBtn.disabled = true;
        this._startBtn.querySelector('.btn__label').textContent = 'Start';
        this._startBtn.querySelector('.btn__icon').innerHTML = SVG_PLAY;
        this._pauseBtn.disabled = false;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        this._pauseBtn.classList.remove('btn--resume');
        this._stopBtn.disabled = false;
        break;

      case 'paused':
        this._startBtn.querySelector('.btn__label').textContent = 'Resume';
        this._startBtn.querySelector('.btn__icon').innerHTML = SVG_PLAY;
        this._startBtn.disabled = false;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = false;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        this._pauseBtn.classList.remove('btn--resume');
        break;

      case 'stopping':
        this._startBtn.disabled = true;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = true;
        break;

      default:
        break;
    }
  }

  // ─── Handlers ───────────────────────────────────────────

  _handleStart() {
    if (this._state === 'paused') {
      this._callbacks.onResume?.();
    } else if (this._state === 'idle') {
      this._setState('starting');
      this._callbacks.onStart?.();
    }
  }

  _handlePause() {
    if (this._state === 'active') {
      this._callbacks.onPause?.();
    }
  }

  _handleStop() {
    if (this._state === 'active' || this._state === 'paused') {
      this._setState('stopping');
      this._callbacks.onStop?.();
    }
  }

  _handleHistory() {
    this._callbacks.onHistory?.();
  }

  // ─── Public API ─────────────────────────────────────────

  /**
   * Programmatically set state (used by main app).
   * @param {SessionState} state
   */
  setState(state) {
    this._setState(state);
  }

  /**
   * Get current state.
   * @returns {SessionState}
   */
  getState() {
    return this._state;
  }

  // ─── Cleanup ────────────────────────────────────────────

  destroy() {
    this._unsubStarted?.();
    this._unsubPaused?.();
    this._unsubResumed?.();
    this._unsubStopped?.();
  }
}
