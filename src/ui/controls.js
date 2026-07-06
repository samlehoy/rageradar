/**
 * Session control buttons component.
 * Start, pause, stop, and history buttons with keyboard shortcuts.
 * Listens to session lifecycle events to update button disabled states.
 */
import { eventBus } from '../utils/event-bus.js';

// Premium high-fidelity neumorphic button styles
const BTN_START_ACTIVE = 'neu-btn-primary bg-violet text-white px-6 py-2.5 rounded-full font-dm text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98]';
const BTN_PAUSE_ACTIVE = 'neu-btn text-fg px-4 py-2 rounded-full font-dm text-xs font-bold flex items-center gap-1.5 transition-all hover:text-amber-500 active:scale-[0.98]';
const BTN_STOP_ACTIVE = 'neu-btn text-fg px-4 py-2 rounded-full font-dm text-xs font-bold flex items-center gap-1.5 transition-all hover:text-red-500 active:scale-[0.98]';

const BTN_DISABLED_PAUSE_STOP = 'neu-inset-sm text-muted/30 px-4 py-2 rounded-full font-dm text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-60 pointer-events-none';
const BTN_DISABLED_START = 'neu-inset-sm text-muted/30 px-6 py-2.5 rounded-full font-dm text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-60 pointer-events-none';

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
    this._autosave = true;

    this._render();
    this._cacheRefs();
    this._bindEvents();
    this._subscribe();

    this._updateButtonStates();
  }

  _render() {
    this.container.className = 'mt-3 lg:mt-4 neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel flex-shrink-0';
    this.container.setAttribute('role', 'toolbar');
    this.container.setAttribute('aria-label', 'Session controls');

    this.container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div class="flex items-center gap-2 md:gap-3 min-w-0">
          <div class="neu-inset-sm rounded-[10px] px-2.5 py-1 font-mono text-[10px] font-bold text-muted" id="ctrl-session-tag">SESSION --</div>
          <button class="neu-btn px-3.5 py-1.5 rounded-full font-dm text-xs font-bold text-fg hover:text-violet flex items-center gap-1.5 transition-all active:scale-[0.98]" id="ctrl-history" aria-label="View session history">
            <iconify-icon icon="lucide:history" class="text-sm"></iconify-icon>
            History
          </button>
          <div class="flex items-center gap-2 ml-2">
            <span class="font-dm text-[10px] font-bold uppercase tracking-wider text-muted">Auto-save</span>
            <button class="neu-inset-sm w-8 h-4 rounded-full p-[2px] relative flex items-center" id="ctrl-autosave-toggle" aria-label="Toggle auto-save">
              <span class="w-3 h-3 rounded-full bg-teal-400 absolute right-[2px] transition-all" id="ctrl-autosave-dot"></span>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button class="${BTN_DISABLED_PAUSE_STOP}" id="ctrl-pause" disabled aria-label="Pause session">
            <iconify-icon icon="lucide:pause" class="text-sm"></iconify-icon>
            <span class="btn__label">Pause</span>
          </button>
          <button class="${BTN_DISABLED_PAUSE_STOP}" id="ctrl-stop" disabled aria-label="Stop session">
            <iconify-icon icon="lucide:square" class="text-sm"></iconify-icon>
            <span class="btn__label">Stop</span>
          </button>
          <button class="${BTN_START_ACTIVE}" id="ctrl-start" aria-label="Start session">
            <iconify-icon icon="lucide:play" class="text-sm" id="ctrl-start-icon"></iconify-icon>
            <span class="btn__label">Start</span>
          </button>
        </div>
      </div>
    `;
  }

  _cacheRefs() {
    this._startBtn = this.container.querySelector('#ctrl-start');
    this._pauseBtn = this.container.querySelector('#ctrl-pause');
    this._stopBtn = this.container.querySelector('#ctrl-stop');
    this._historyBtn = this.container.querySelector('#ctrl-history');
    this._sessionTag = this.container.querySelector('#ctrl-session-tag');
    this._autosaveBtn = this.container.querySelector('#ctrl-autosave-toggle');
    this._autosaveDot = this.container.querySelector('#ctrl-autosave-dot');
  }

  _bindEvents() {
    this._startBtn.addEventListener('click', () => this._handleStart());
    this._pauseBtn.addEventListener('click', () => this._handlePause());
    this._stopBtn.addEventListener('click', () => this._handleStop());
    this._historyBtn.addEventListener('click', () => this._handleHistory());

    if (this._autosaveBtn && this._autosaveDot) {
      this._autosaveBtn.addEventListener('click', () => {
        this._autosave = !this._autosave;
        if (this._autosave) {
          this._autosaveDot.className = 'w-3 h-3 rounded-full bg-teal-400 absolute right-[2px] transition-all';
        } else {
          this._autosaveDot.className = 'w-3 h-3 rounded-full bg-gray-400 absolute left-[2px] transition-all';
        }
      });
    }
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
      this.setSessionId(null);
    });
  }

  _setState(newState) {
    this._state = newState;
    this._updateButtonStates();
  }

  _updateButtonStates() {
    switch (this._state) {
      case 'idle':
        this._startBtn.disabled = false;
        this._startBtn.className = BTN_START_ACTIVE;
        this._startBtn.querySelector('#ctrl-start-icon').setAttribute('icon', 'lucide:play');
        this._startBtn.querySelector('.btn__label').textContent = 'Start';
        
        this._pauseBtn.disabled = true;
        this._pauseBtn.className = BTN_DISABLED_PAUSE_STOP;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        
        this._stopBtn.disabled = true;
        this._stopBtn.className = BTN_DISABLED_PAUSE_STOP;
        break;

      case 'starting':
        this._startBtn.disabled = true;
        this._startBtn.className = BTN_DISABLED_START;
        
        this._pauseBtn.disabled = true;
        this._pauseBtn.className = BTN_DISABLED_PAUSE_STOP;
        
        this._stopBtn.disabled = true;
        this._stopBtn.className = BTN_DISABLED_PAUSE_STOP;
        break;

      case 'active':
        this._startBtn.disabled = true;
        this._startBtn.className = BTN_DISABLED_START;
        this._startBtn.querySelector('#ctrl-start-icon').setAttribute('icon', 'lucide:play');
        this._startBtn.querySelector('.btn__label').textContent = 'Start';
        
        this._pauseBtn.disabled = false;
        this._pauseBtn.className = BTN_PAUSE_ACTIVE;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        
        this._stopBtn.disabled = false;
        this._stopBtn.className = BTN_STOP_ACTIVE;
        break;

      case 'paused':
        this._startBtn.disabled = false;
        this._startBtn.className = BTN_START_ACTIVE;
        this._startBtn.querySelector('#ctrl-start-icon').setAttribute('icon', 'lucide:play');
        this._startBtn.querySelector('.btn__label').textContent = 'Resume';
        
        this._pauseBtn.disabled = true;
        this._pauseBtn.className = BTN_DISABLED_PAUSE_STOP;
        this._pauseBtn.querySelector('.btn__label').textContent = 'Pause';
        
        this._stopBtn.disabled = false;
        this._stopBtn.className = BTN_STOP_ACTIVE;
        break;

      case 'stopping':
        this._startBtn.disabled = true;
        this._startBtn.className = BTN_DISABLED_START;
        
        this._pauseBtn.disabled = true;
        this._pauseBtn.className = BTN_DISABLED_PAUSE_STOP;
        
        this._stopBtn.disabled = true;
        this._stopBtn.className = BTN_DISABLED_PAUSE_STOP;
        break;

      default:
        break;
    }
  }

  setSessionId(id) {
    if (this._sessionTag) {
      this._sessionTag.textContent = id ? `SESSION #${id.substring(0, 6).toUpperCase()}` : 'SESSION --';
    }
  }

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

  setState(state) {
    this._setState(state);
  }

  getState() {
    return this._state;
  }

  destroy() {
    this._unsubStarted?.();
    this._unsubPaused?.();
    this._unsubResumed?.();
    this._unsubStopped?.();
  }
}
