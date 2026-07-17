/**
 * CooldownTimer — A minimal countdown overlay shown after a rage peak.
 * Displays an SVG ring that depletes clockwise with MM:SS countdown.
 * Non-intrusive, fixed bottom-right, dismissible.
 */
import { eventBus } from '../utils/event-bus.js';

/** Circumference of the SVG circle (r=26, C = 2πr). */
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 26; // ≈ 163.36

export class CooldownTimer {
  constructor() {
    this._el = null;
    this._interval = null;
    this._remaining = 0;
    this._totalMs = 0;
    this._onComplete = null;
    this._onDismiss = null;
  }

  /**
   * Show a countdown timer overlay.
   * @param {number} durationMs - Total duration in milliseconds
   * @param {Object} options
   * @param {string} [options.message='Cool down...'] - Message to show
   * @param {Function} [options.onComplete] - Callback when timer finishes
   * @param {Function} [options.onDismiss] - Callback when user dismisses
   */
  show(durationMs, options = {}) {
    // Tear down any existing timer
    this.destroy();

    this._totalMs = durationMs;
    this._remaining = durationMs;
    this._onComplete = options.onComplete || null;
    this._onDismiss = options.onDismiss || null;
    const message = options.message || 'Cool down...';

    // Build DOM
    this._el = document.createElement('div');
    this._el.className = 'cooldown-timer-overlay';
    this._el.setAttribute('role', 'status');
    this._el.setAttribute('aria-label', `Cooldown timer: ${this._formatTime(this._remaining)}`);

    this._el.innerHTML = `
      <div class="cooldown-timer-content">
        <div class="cooldown-timer-ring">
          <svg viewBox="0 0 60 60">
            <circle class="timer-track" cx="30" cy="30" r="26" />
            <circle class="timer-progress" cx="30" cy="30" r="26"
                    stroke-dasharray="${CIRCLE_CIRCUMFERENCE.toFixed(2)}"
                    stroke-dashoffset="0" />
          </svg>
          <span class="timer-value">${this._formatTime(this._remaining)}</span>
        </div>
        <div class="cooldown-timer-label">${message}</div>
        <button class="cooldown-timer-dismiss" aria-label="Dismiss timer">✕</button>
      </div>
    `;

    // Cache refs
    this._progressCircle = this._el.querySelector('.timer-progress');
    this._valueEl = this._el.querySelector('.timer-value');
    this._dismissBtn = this._el.querySelector('.cooldown-timer-dismiss');

    // Dismiss handler
    this._dismissBtn.addEventListener('click', () => this.dismiss());

    // Append to DOM
    document.body.appendChild(this._el);

    // Trigger fade-in on next frame
    requestAnimationFrame(() => {
      this._el.classList.add('cooldown-timer-overlay--visible');
    });

    // Emit start event
    eventBus.emit('cooldown:timer-started', { durationMs, message });

    // Start countdown (update every second)
    const startTime = Date.now();
    this._interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      this._remaining = Math.max(0, this._totalMs - elapsed);

      this._updateDisplay();

      if (this._remaining <= 0) {
        this._complete();
      }
    }, 250); // Update 4x/sec for smooth ring animation
  }

  /**
   * Dismiss the timer (user-initiated).
   */
  dismiss() {
    if (!this._el) return;

    // Stop interval
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    // Fade out
    this._el.classList.remove('cooldown-timer-overlay--visible');
    this._el.classList.add('cooldown-timer-overlay--closing');

    eventBus.emit('cooldown:timer-dismissed', {
      remainingMs: this._remaining,
      totalMs: this._totalMs,
    });

    if (this._onDismiss) {
      this._onDismiss();
    }

    // Remove from DOM after animation
    setTimeout(() => {
      this._removeElement();
    }, 300);
  }

  /**
   * Clean up everything.
   */
  destroy() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._removeElement();
    this._onComplete = null;
    this._onDismiss = null;
  }

  /* ─── Private ─────────────────────────────────────── */

  _complete() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    // Final display state
    this._remaining = 0;
    this._updateDisplay();

    eventBus.emit('cooldown:timer-completed', { totalMs: this._totalMs });

    if (this._onComplete) {
      this._onComplete();
    }

    // Fade out after a brief moment
    setTimeout(() => {
      if (this._el) {
        this._el.classList.remove('cooldown-timer-overlay--visible');
        this._el.classList.add('cooldown-timer-overlay--closing');
        setTimeout(() => this._removeElement(), 300);
      }
    }, 600);
  }

  _updateDisplay() {
    if (!this._progressCircle || !this._valueEl) return;

    // Update countdown text
    this._valueEl.textContent = this._formatTime(this._remaining);

    // Update SVG ring: offset goes from 0 (full) → circumference (empty)
    const progress = 1 - (this._remaining / this._totalMs);
    const offset = progress * CIRCLE_CIRCUMFERENCE;
    this._progressCircle.style.strokeDashoffset = offset.toFixed(2);

    // Update aria
    if (this._el) {
      this._el.setAttribute('aria-label', `Cooldown timer: ${this._formatTime(this._remaining)}`);
    }
  }

  _formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  _removeElement() {
    if (this._el) {
      this._el.remove();
      this._el = null;
      this._progressCircle = null;
      this._valueEl = null;
      this._dismissBtn = null;
    }
  }
}
