/**
 * BreathingOverlay — Full-screen guided breathing exercise.
 *
 * Techniques:
 *   '4-7-8'  — Inhale 4 s, Hold 7 s, Exhale 8 s  (default)
 *   '4-4-4-4' — Box breathing: 4 s each phase
 *
 * Usage:
 *   const overlay = new BreathingOverlay();
 *   const result = await overlay.show({ technique: '4-7-8', rounds: 4 });
 *   // result → { completed: boolean, rounds: number }
 */

const TECHNIQUES = {
  '4-7-8': { inhale: 4, hold: 7, exhale: 8 },
  '4-4-4-4': { inhale: 4, hold: 4, exhale: 4 },
};

export class BreathingOverlay {
  constructor() {
    /** @type {HTMLElement|null} */
    this._el = null;
    this._cancelled = false;
    this._phaseTimer = null;
    this._countdownInterval = null;
    this._boundKeyHandler = this._onKey.bind(this);
  }

  /* ────────────────────────────────────────────── *
   *  Public API
   * ────────────────────────────────────────────── */

  /**
   * Show the overlay and run the exercise.
   * @param {Object}  options
   * @param {'4-7-8'|'4-4-4-4'} options.technique  Breathing technique (default '4-7-8')
   * @param {number}             options.rounds     Number of rounds  (default 4)
   * @returns {Promise<{completed: boolean, rounds: number}>}
   */
  async show(options = {}) {
    const technique = options.technique || '4-7-8';
    const rounds = options.rounds ?? 4;
    const timing = TECHNIQUES[technique] || TECHNIQUES['4-7-8'];

    this._cancelled = false;
    this._createDOM(rounds);
    document.addEventListener('keydown', this._boundKeyHandler);

    const totalPhases = rounds * 3; // inhale + hold + exhale per round
    let completedPhases = 0;
    let roundsCompleted = 0;

    for (let round = 0; round < rounds; round++) {
      if (this._cancelled) break;

      // Update round label
      this._roundLabel.textContent = `Round ${round + 1} of ${rounds}`;

      // Inhale
      if (this._cancelled) break;
      await this._phase('Inhale', timing.inhale * 1000, 1.6, 'ease-in');
      completedPhases++;
      this._updateProgress(completedPhases, totalPhases);

      // Hold
      if (this._cancelled) break;
      await this._phase('Hold', timing.hold * 1000, 1.6, 'ease-in-out');
      completedPhases++;
      this._updateProgress(completedPhases, totalPhases);

      // Exhale
      if (this._cancelled) break;
      await this._phase('Exhale', timing.exhale * 1000, 1.0, 'ease-out');
      completedPhases++;
      this._updateProgress(completedPhases, totalPhases);

      if (!this._cancelled) {
        roundsCompleted = round + 1;
      }
    }

    const completed = !this._cancelled;
    await this._removeDOM();

    return { completed, rounds: roundsCompleted };
  }

  /** Force-close the overlay (user cancelled). */
  close() {
    this._cancelled = true;
    this._clearTimers();
  }

  /** Clean up any lingering DOM / listeners. */
  destroy() {
    this.close();
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
      this._el = null;
    }
    document.removeEventListener('keydown', this._boundKeyHandler);
  }

  /* ────────────────────────────────────────────── *
   *  Internal — DOM
   * ────────────────────────────────────────────── */

  /** @param {number} totalRounds */
  _createDOM(totalRounds) {
    const overlay = document.createElement('div');
    overlay.className = 'breathing-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Breathing exercise');

    overlay.innerHTML = `
      <div class="breathing-content">
        <div class="breathing-round">Round 1 of ${totalRounds}</div>

        <div class="breathing-circle-container">
          <div class="breathing-circle breathing-circle--inhale"></div>
          <div class="breathing-phase-label">Get Ready</div>
          <div class="breathing-timer"></div>
        </div>

        <div class="breathing-progress">
          <div class="breathing-progress-bar"></div>
        </div>

        <div class="breathing-controls">
          <button class="breathing-skip" type="button">Skip Round</button>
          <button class="breathing-stop" type="button">Stop Exercise</button>
        </div>
      </div>
    `;

    // Cache references
    this._el = overlay;
    this._roundLabel = overlay.querySelector('.breathing-round');
    this._circle = overlay.querySelector('.breathing-circle');
    this._label = overlay.querySelector('.breathing-phase-label');
    this._timer = overlay.querySelector('.breathing-timer');
    this._progressBar = overlay.querySelector('.breathing-progress-bar');

    // Button handlers
    overlay.querySelector('.breathing-stop').addEventListener('click', () => this.close());
    overlay.querySelector('.breathing-skip').addEventListener('click', () => this._skipPhase());

    document.body.appendChild(overlay);
  }

  /**
   * Animate the closing transition, then remove the element.
   * @returns {Promise<void>}
   */
  _removeDOM() {
    return new Promise((resolve) => {
      document.removeEventListener('keydown', this._boundKeyHandler);

      if (!this._el) {
        resolve();
        return;
      }

      this._el.classList.add('breathing-overlay--closing');
      const onEnd = () => {
        if (this._el && this._el.parentNode) {
          this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
        resolve();
      };
      this._el.addEventListener('animationend', onEnd, { once: true });

      // Fallback in case animationend doesn't fire
      setTimeout(onEnd, 400);
    });
  }

  /* ────────────────────────────────────────────── *
   *  Internal — Phase execution
   * ────────────────────────────────────────────── */

  /**
   * Run a single breathing phase (Inhale / Hold / Exhale).
   * @param {'Inhale'|'Hold'|'Exhale'} name
   * @param {number} durationMs
   * @param {number} targetScale
   * @param {string} easing
   * @returns {Promise<void>}
   */
  _phase(name, durationMs, targetScale, easing) {
    return new Promise((resolve) => {
      if (this._cancelled) { resolve(); return; }

      // Update label
      this._label.textContent = name;

      // Update circle class for gradient / glow
      this._circle.className = 'breathing-circle';
      const phaseClass = name.toLowerCase();
      this._circle.classList.add(`breathing-circle--${phaseClass}`);

      // Animate scale
      this._circle.style.transition = `transform ${durationMs}ms ${easing}, background 600ms ease-out, box-shadow 600ms ease-out`;
      this._circle.style.transform = `scale(${targetScale})`;

      // Countdown timer
      let remaining = Math.ceil(durationMs / 1000);
      this._timer.textContent = remaining;

      this._countdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          this._timer.textContent = '';
          clearInterval(this._countdownInterval);
          this._countdownInterval = null;
        } else {
          this._timer.textContent = remaining;
        }
      }, 1000);

      // Store resolve so skip can call it
      this._currentPhaseResolve = resolve;

      this._phaseTimer = setTimeout(() => {
        this._clearTimers();
        this._currentPhaseResolve = null;
        resolve();
      }, durationMs);
    });
  }

  /** Skip the current phase immediately. */
  _skipPhase() {
    this._clearTimers();
    if (this._currentPhaseResolve) {
      const r = this._currentPhaseResolve;
      this._currentPhaseResolve = null;
      r();
    }
  }

  _clearTimers() {
    if (this._phaseTimer) { clearTimeout(this._phaseTimer); this._phaseTimer = null; }
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
  }

  /* ────────────────────────────────────────────── *
   *  Internal — Progress
   * ────────────────────────────────────────────── */

  /**
   * @param {number} completed
   * @param {number} total
   */
  _updateProgress(completed, total) {
    if (this._progressBar) {
      const pct = Math.round((completed / total) * 100);
      this._progressBar.style.width = `${pct}%`;
    }
  }

  /* ────────────────────────────────────────────── *
   *  Internal — Keyboard
   * ────────────────────────────────────────────── */

  /** @param {KeyboardEvent} e */
  _onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }
}
