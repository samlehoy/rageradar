/**
 * BreakReminder — Non-intrusive banner suggesting a break.
 *
 * Usage:
 *   const reminder = new BreakReminder();
 *   reminder.onTakeBreak = () => { ... open breathing exercise ... };
 *   reminder.show('You've been going for a while — take a short break');
 *   // User can snooze or dismiss via the banner buttons.
 */

export class BreakReminder {
  constructor() {
    /** @type {HTMLElement|null} */
    this._el = null;
    this._snoozeTimer = null;

    /**
     * Called when the user clicks "Take a Break".
     * Override this to open the breathing overlay or another intervention.
     * @type {(() => void)|null}
     */
    this.onTakeBreak = null;

    /**
     * Called when the user snoozes.
     * Receives the snooze duration in minutes.
     * @type {((minutes: number) => void)|null}
     */
    this.onSnooze = null;

    /**
     * Called when the user dismisses.
     * @type {(() => void)|null}
     */
    this.onDismiss = null;
  }

  /* ────────────────────────────────────────────── *
   *  Public API
   * ────────────────────────────────────────────── */

  /**
   * Show the break-reminder banner.
   * @param {string} message  The message to display (default provided).
   */
  show(message = 'Consider taking a short break') {
    // Remove any existing banner first
    this._removeDOM(false);

    const el = document.createElement('div');
    el.className = 'break-reminder';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');

    el.innerHTML = `
      <div class="break-reminder__message">${this._escapeHTML(message)}</div>
      <div class="break-reminder__actions">
        <button class="break-reminder__take-break" type="button">Take a Break</button>
        <button class="break-reminder__snooze" type="button">Snooze 5m</button>
        <button class="break-reminder__dismiss" type="button" aria-label="Dismiss">✕</button>
      </div>
    `;

    // Event listeners
    el.querySelector('.break-reminder__take-break').addEventListener('click', () => {
      this.dismiss();
      if (this.onTakeBreak) this.onTakeBreak();
    });

    el.querySelector('.break-reminder__snooze').addEventListener('click', () => {
      this.snooze(5);
    });

    el.querySelector('.break-reminder__dismiss').addEventListener('click', () => {
      this.dismiss();
    });

    this._el = el;
    document.body.appendChild(el);
  }

  /** Dismiss the reminder immediately. */
  dismiss() {
    this._removeDOM(true);
    if (this.onDismiss) this.onDismiss();
  }

  /**
   * Snooze: hide now and re-show after `minutes`.
   * @param {number} minutes  Snooze duration (default 5).
   */
  snooze(minutes = 5) {
    const msg = this._el
      ? this._el.querySelector('.break-reminder__message')?.textContent || 'Consider taking a short break'
      : 'Consider taking a short break';

    this._removeDOM(true);
    if (this.onSnooze) this.onSnooze(minutes);

    this._snoozeTimer = setTimeout(() => {
      this._snoozeTimer = null;
      this.show(msg);
    }, minutes * 60 * 1000);
  }

  /** Tear down everything — DOM, timers. */
  destroy() {
    this._removeDOM(false);
    if (this._snoozeTimer) {
      clearTimeout(this._snoozeTimer);
      this._snoozeTimer = null;
    }
  }

  /* ────────────────────────────────────────────── *
   *  Internal
   * ────────────────────────────────────────────── */

  /**
   * @param {boolean} animate  Whether to play the slide-out animation.
   */
  _removeDOM(animate) {
    if (!this._el) return;

    if (animate) {
      this._el.classList.add('break-reminder--closing');
      const el = this._el;
      const onEnd = () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      };
      el.addEventListener('animationend', onEnd, { once: true });
      setTimeout(onEnd, 400); // fallback
      this._el = null;
    } else {
      if (this._el.parentNode) this._el.parentNode.removeChild(this._el);
      this._el = null;
    }
  }

  /**
   * Minimal HTML-escape to prevent injection in message text.
   * @param {string} str
   * @returns {string}
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
