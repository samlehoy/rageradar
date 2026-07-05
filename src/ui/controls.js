/**
 * Session control buttons component.
 * Start, pause, stop, and history buttons with keyboard shortcuts.
 * Listens to session lifecycle events to update button disabled states.
 */
import { eventBus } from '../utils/event-bus.js';

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
      <button class="btn btn--history" id="ctrl-history" aria-label="View session history">
        <span class="btn__icon"><iconify-icon icon="lucide:history"></iconify-icon></span>
        <span class="btn__label">History</span>
      </button>
      <span class="session-controls__spacer"></span>
      <button class="btn btn--secondary" id="ctrl-pause" disabled aria-label="Pause session">
        <span class="btn__icon"><iconify-icon icon="lucide:pause"></iconify-icon></span>
        <span class="btn__label">Pause</span>
      </button>
      <button class="btn btn--stop" id="ctrl-stop" disabled aria-label="Stop session">
        <span class="btn__icon"><iconify-icon icon="lucide:square"></iconify-icon></span>
        <span class="btn__label">Stop</span>
      </button>
      <button class="btn btn--primary" id="ctrl-start" aria-label="Start session">
        <span class="btn__icon"><iconify-icon icon="lucide:play"></iconify-icon></span>
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
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        break;

      case 'starting':
        this._startBtn.disabled = true;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = true;
        break;

      case 'active':
        this._startBtn.disabled = true;
        this._startBtn.querySelector('.btn__label').textContent = 'Start';
        this._pauseBtn.disabled = false;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        this._stopBtn.disabled = false;
        break;

      case 'paused':
        this._startBtn.querySelector('.btn__label').textContent = 'Resume';
        this._startBtn.disabled = false;
        this._pauseBtn.disabled = true;
        this._stopBtn.disabled = false;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
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
