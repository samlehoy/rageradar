/**
 * Analytics Dashboard Component.
 * Slide-in panel with tabbed interface showing trends, heatmap,
 * peak analysis, and data export functionality.
 */
import { Chart } from 'chart.js/auto';
import { createFocusTrap } from '../utils/focus-trap.js';
import { HeatmapChart } from './heatmap-chart.js';
import { getRageColor } from '../utils/rage-levels.js';

/**
 * Format milliseconds as a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
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

/**
 * Trigger a file download in the browser.
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const TABS = [
  { id: 'trends', label: 'Trends' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'peaks', label: 'Peaks' },
  { id: 'export', label: 'Export' },
  { id: 'compare', label: 'Compare' },
];

export class AnalyticsDashboard {
  /**
   * @param {Object} analyticsEngine - AnalyticsEngine instance
   * @param {Object} [gameProfileManager] - GameProfileManager instance
   */
  constructor(analyticsEngine, gameProfileManager = null) {
    this._engine = analyticsEngine;
    this._gameProfileManager = gameProfileManager;
    this._selectedProfileId = null;
    this._isOpen = false;
    this._activeTab = 'trends';
    this._trendRange = '30d';
    this._heatmapYear = new Date().getFullYear();
    this._previouslyFocused = null;

    // Chart instances
    this._trendsChart = null;
    this._peaksChart = null;
    this._heatmapChart = null;
    this._compareChart = null;

    // Bound handlers
    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);

    this._render();
    this._focusTrap = createFocusTrap(this._wrapper);
  }

  /**
   * Create the wrapper/backdrop/panel DOM skeleton.
   */
  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'analytics-wrapper';
    wrapper.innerHTML = `
      <div class="analytics-backdrop"></div>
      <div class="analytics-panel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Analytics Dashboard">
        <!-- Dynamic content injected here -->
      </div>
    `;

    this._wrapper = wrapper;
    this._panel = wrapper.querySelector('.analytics-panel');
    this._backdrop = wrapper.querySelector('.analytics-backdrop');

    document.body.appendChild(wrapper);
  }

  /**
   * Build the full panel interior (header, tabs, summary, content).
   */
  _renderContent() {
    this._panel.innerHTML = `
      <!-- Header -->
      <div class="analytics-header">
        <h2 class="analytics-title">
          <span>📊</span> Analytics
        </h2>
        <button class="analytics-close" aria-label="Close analytics">
          <iconify-icon icon="lucide:x"></iconify-icon>
        </button>
      </div>

      <!-- Profile Filter -->
      <div class="analytics-profile-filter" id="analytics-profile-filter">
        <label class="analytics-profile-filter__label">Filter by game:</label>
        <select id="analytics-profile-select" class="analytics-profile-filter__select neu-inset-sm">
          <option value="">All Games</option>
        </select>
      </div>

      <!-- Tab Navigation -->
      <div class="analytics-tabs" role="tablist">
        ${TABS.map(tab => `
          <button
            class="analytics-tab ${tab.id === this._activeTab ? 'analytics-tab--active' : ''}"
            role="tab"
            aria-selected="${tab.id === this._activeTab}"
            data-tab="${tab.id}"
          >${tab.label}</button>
        `).join('')}
      </div>

      <!-- Body -->
      <div class="analytics-body neu-scroll">
        <!-- Summary Cards -->
        <div class="analytics-summary" id="analytics-summary"></div>

        <!-- Tab Panels -->
        <div class="analytics-content">
          <!-- Trends -->
          <div class="analytics-tab-panel ${this._activeTab === 'trends' ? 'analytics-tab-panel--active' : ''}" data-panel="trends">
            <div class="analytics-range-selector">
              <button class="analytics-range-btn ${this._trendRange === '7d' ? 'analytics-range-btn--active' : ''}" data-range="7d">7d</button>
              <button class="analytics-range-btn ${this._trendRange === '30d' ? 'analytics-range-btn--active' : ''}" data-range="30d">30d</button>
              <button class="analytics-range-btn ${this._trendRange === '90d' ? 'analytics-range-btn--active' : ''}" data-range="90d">90d</button>
            </div>
            <div class="analytics-chart-well">
              <div class="analytics-chart-container">
                <canvas id="analytics-trends-canvas"></canvas>
              </div>
            </div>
          </div>

          <!-- Heatmap -->
          <div class="analytics-tab-panel ${this._activeTab === 'heatmap' ? 'analytics-tab-panel--active' : ''}" data-panel="heatmap">
            <div class="analytics-heatmap-nav">
              <button class="analytics-heatmap-nav__btn" data-heatmap-nav="prev" aria-label="Previous year">
                <iconify-icon icon="lucide:chevron-left"></iconify-icon>
              </button>
              <span class="analytics-heatmap-nav__label" id="analytics-heatmap-year">${this._heatmapYear}</span>
              <button class="analytics-heatmap-nav__btn" data-heatmap-nav="next" aria-label="Next year">
                <iconify-icon icon="lucide:chevron-right"></iconify-icon>
              </button>
            </div>
            <div class="analytics-chart-well">
              <div class="analytics-chart-container">
                <canvas id="analytics-heatmap-canvas"></canvas>
              </div>
            </div>
            <div class="analytics-heatmap-legend">
              <span class="analytics-heatmap-legend__label">Less</span>
              <div class="analytics-heatmap-legend__scale">
                <span class="analytics-heatmap-legend__swatch" style="background: rgba(0,0,0,0.05)"></span>
                <span class="analytics-heatmap-legend__swatch" style="background: #22c55e"></span>
                <span class="analytics-heatmap-legend__swatch" style="background: #84cc16"></span>
                <span class="analytics-heatmap-legend__swatch" style="background: #eab308"></span>
                <span class="analytics-heatmap-legend__swatch" style="background: #f97316"></span>
                <span class="analytics-heatmap-legend__swatch" style="background: #ef4444"></span>
              </div>
              <span class="analytics-heatmap-legend__label">More</span>
            </div>
          </div>

          <!-- Peaks -->
          <div class="analytics-tab-panel ${this._activeTab === 'peaks' ? 'analytics-tab-panel--active' : ''}" data-panel="peaks">
            <h3 class="analytics-section-title">Average Rage by Hour of Day</h3>
            <div class="analytics-chart-well">
              <div class="analytics-chart-container">
                <canvas id="analytics-peaks-canvas"></canvas>
              </div>
            </div>
          </div>

          <!-- Export -->
          <div class="analytics-tab-panel ${this._activeTab === 'export' ? 'analytics-tab-panel--active' : ''}" data-panel="export">
            <h3 class="analytics-section-title">Export Your Data</h3>
            <p class="analytics-export-count" style="font-family: var(--font-body); font-size: var(--text-small); color: var(--muted); margin-bottom: var(--space-4);">
              Loading session count…
            </p>
            <div class="analytics-export-grid">
              <button class="analytics-export-btn" data-export="csv">
                <span class="analytics-export-btn__icon">📄</span>
                <span class="analytics-export-btn__label">Download CSV</span>
                <span class="analytics-export-btn__sub">Spreadsheet-friendly format</span>
              </button>
              <button class="analytics-export-btn" data-export="json">
                <span class="analytics-export-btn__icon">📋</span>
                <span class="analytics-export-btn__label">Download JSON</span>
                <span class="analytics-export-btn__sub">Developer-friendly format</span>
              </button>
            </div>
          </div>

          <!-- Compare -->
          <div class="analytics-tab-panel ${this._activeTab === 'compare' ? 'analytics-tab-panel--active' : ''}" data-panel="compare">
            <div id="analytics-compare-content"></div>
          </div>
        </div>
      </div>
    `;

    this._populateProfileFilter();
    this._bindEvents();
  }

  /**
   * Attach event listeners to panel elements.
   */
  _bindEvents() {
    // Close button
    this._panel.querySelector('.analytics-close')
      .addEventListener('click', () => this.close());

    // Tab buttons
    this._panel.querySelectorAll('.analytics-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._switchTab(btn.dataset.tab);
      });
    });

    // Range buttons (trends)
    this._panel.querySelectorAll('.analytics-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._trendRange = btn.dataset.range;
        this._updateRangeButtons();
        this._loadTrends();
      });
    });

    // Heatmap navigation
    this._panel.querySelectorAll('[data-heatmap-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.heatmapNav === 'prev') this._heatmapYear--;
        else this._heatmapYear++;
        this._panel.querySelector('#analytics-heatmap-year').textContent = this._heatmapYear;
        this._loadHeatmap();
      });
    });

    // Export buttons
    this._panel.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._handleExport(btn.dataset.export);
      });
    });

    // Profile filter
    const profileSelect = this._panel.querySelector('#analytics-profile-select');
    if (profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        this._selectedProfileId = e.target.value || null;
        this._refreshCurrentView();
      });
    }
  }

  /**
   * Switch active tab and update visuals.
   * @param {string} tabId
   */
  _switchTab(tabId) {
    this._activeTab = tabId;

    // Update tab buttons
    this._panel.querySelectorAll('.analytics-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('analytics-tab--active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });

    // Update tab panels
    this._panel.querySelectorAll('.analytics-tab-panel').forEach(panel => {
      panel.classList.toggle('analytics-tab-panel--active', panel.dataset.panel === tabId);
    });

    // Load data for newly active tab
    this._loadTabData(tabId);
  }

  /**
   * Update range button active states.
   */
  _updateRangeButtons() {
    this._panel.querySelectorAll('.analytics-range-btn').forEach(btn => {
      btn.classList.toggle('analytics-range-btn--active', btn.dataset.range === this._trendRange);
    });
  }

  /**
   * Load data for a specific tab.
   * @param {string} tabId
   */
  async _loadTabData(tabId) {
    try {
      switch (tabId) {
        case 'trends':
          await this._loadTrends();
          break;
        case 'heatmap':
          await this._loadHeatmap();
          break;
        case 'peaks':
          await this._loadPeaks();
          break;
        case 'export':
          await this._loadExportInfo();
          break;
        case 'compare':
          await this._loadCompare();
          break;
      }
    } catch (err) {
      console.error(`Failed to load ${tabId} data:`, err);
    }
  }

  /**
   * Load and render summary cards.
   */
  async _loadSummary() {
    const container = this._panel.querySelector('#analytics-summary');
    if (!container) return;

    try {
      const opts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
      const stats = await this._engine.getOverallStats(opts);

      container.innerHTML = `
        <div class="analytics-summary-card">
          <span class="analytics-summary-card__label">Total Sessions</span>
          <span class="analytics-summary-card__value">${stats.totalSessions}</span>
        </div>
        <div class="analytics-summary-card">
          <span class="analytics-summary-card__label">Total Time</span>
          <span class="analytics-summary-card__value">${formatDuration(stats.totalDuration)}</span>
        </div>
        <div class="analytics-summary-card">
          <span class="analytics-summary-card__label">Avg Rage</span>
          <span class="analytics-summary-card__value" style="color: ${getRageColor(stats.overallAvg)}">${Math.round(stats.overallAvg)}</span>
        </div>
        <div class="analytics-summary-card">
          <span class="analytics-summary-card__label">Best / Worst</span>
          <span class="analytics-summary-card__value">
            <span style="color: var(--rage-calm)">${Math.round(stats.bestSession?.avg ?? 0)}</span>
            <span style="color: var(--muted); font-size: var(--text-small)"> / </span>
            <span style="color: var(--rage-rage)">${Math.round(stats.worstSession?.avg ?? 0)}</span>
          </span>
          <span class="analytics-summary-card__sub">min / max avg</span>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load summary stats:', err);
      container.innerHTML = `
        <div class="analytics-empty" style="grid-column: 1/-1;">
          <span class="analytics-empty__text">Unable to load stats</span>
        </div>
      `;
    }
  }

  /**
   * Load and render the trends line chart.
   */
  async _loadTrends() {
    const canvas = this._panel.querySelector('#analytics-trends-canvas');
    if (!canvas) return;

    // Destroy previous chart
    if (this._trendsChart) {
      this._trendsChart.destroy();
      this._trendsChart = null;
    }

    const opts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
    const data = await this._engine.getTrends(this._trendRange, opts);
    if (!data || !data.daily || data.daily.length === 0) return;

    const ctx = canvas.getContext('2d');

    // Build gradient for the line
    this._trendsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.daily.map(d => d.date),
        datasets: [{
          label: 'Avg Rage',
          data: data.daily.map(d => d.avg),
          borderColor: (context) => {
            const chart = context.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return '#6C63FF';
            const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, '#22c55e');
            gradient.addColorStop(0.25, '#84cc16');
            gradient.addColorStop(0.5, '#eab308');
            gradient.addColorStop(0.75, '#f97316');
            gradient.addColorStop(1, '#ef4444');
            return gradient;
          },
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return 'rgba(108, 99, 255, 0.1)';
            const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(108, 99, 255, 0.18)');
            gradient.addColorStop(1, 'rgba(108, 99, 255, 0.0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: (context) => {
            const value = context.dataset.data[context.dataIndex];
            return getRageColor(value);
          },
          pointHoverBackgroundColor: '#6C63FF',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          borderWidth: 2.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutCubic' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(61, 72, 82, 0.92)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 11, weight: '500' },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label(context) {
                return `Avg Rage: ${Math.round(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 8,
              color: '#9CA3AF',
              font: { family: 'DM Sans', size: 9, weight: 'bold' },
              maxRotation: 45,
            },
            grid: { color: 'rgba(163, 177, 198, 0.15)' },
            border: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#9CA3AF',
              font: { family: 'DM Sans', size: 9, weight: 'bold' },
            },
            grid: { color: 'rgba(163, 177, 198, 0.15)' },
            border: { display: false },
          },
        },
      },
    });
  }

  /**
   * Load and render the heatmap chart.
   */
  async _loadHeatmap() {
    const canvas = this._panel.querySelector('#analytics-heatmap-canvas');
    if (!canvas) return;

    // Destroy previous
    if (this._heatmapChart) {
      this._heatmapChart.destroy();
      this._heatmapChart = null;
    }

    const opts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
    const data = await this._engine.getHeatmapData(this._heatmapYear, null, opts);
    this._heatmapChart = new HeatmapChart(canvas);
    this._heatmapChart.render(data);
  }

  /**
   * Load and render the peaks bar chart.
   */
  async _loadPeaks() {
    const canvas = this._panel.querySelector('#analytics-peaks-canvas');
    if (!canvas) return;

    // Destroy previous
    if (this._peaksChart) {
      this._peaksChart.destroy();
      this._peaksChart = null;
    }

    const opts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
    const data = await this._engine.getPeakAnalysis(opts);
    if (!data || !data.byHour || data.byHour.length === 0) return;

    const ctx = canvas.getContext('2d');

    this._peaksChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.byHour.map(d => `${String(d.hour).padStart(2, '0')}:00`),
        datasets: [{
          label: 'Avg Rage',
          data: data.byHour.map(d => d.avg),
          backgroundColor: data.byHour.map(d => getRageColor(d.avg)),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutCubic' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(61, 72, 82, 0.92)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 11, weight: '500' },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label(context) {
                const hourData = data.byHour[context.dataIndex];
                return [
                  `Avg Rage: ${Math.round(context.parsed.y)}`,
                  `Sessions: ${hourData.count}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 12,
              color: '#9CA3AF',
              font: { family: 'JetBrains Mono', size: 9, weight: 'bold' },
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#9CA3AF',
              font: { family: 'DM Sans', size: 9, weight: 'bold' },
            },
            grid: { color: 'rgba(163, 177, 198, 0.15)' },
            border: { display: false },
          },
        },
      },
    });
  }

  /**
   * Load export tab info (session count).
   */
  async _loadExportInfo() {
    const countEl = this._panel.querySelector('.analytics-export-count');
    if (!countEl) return;

    try {
      const opts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
      const stats = await this._engine.getOverallStats(opts);
      countEl.textContent = `${stats.totalSessions} sessions available for export`;
    } catch {
      countEl.textContent = 'Unable to determine session count';
    }
  }

  /**
   * Handle export button clicks.
   * @param {string} format - 'csv' or 'json'
   */
  async _handleExport(format) {
    try {
      if (format === 'csv') {
        const exportOpts = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
        const csv = await this._engine.exportCSV(exportOpts);
        downloadFile(csv, 'rageradar-sessions.csv', 'text/csv');
      } else {
        const exportOpts2 = this._selectedProfileId ? { profileId: this._selectedProfileId } : {};
        const json = await this._engine.exportJSON(exportOpts2);
        downloadFile(json, 'rageradar-sessions.json', 'application/json');
      }
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
    }
  }

  /**
   * Handle Escape key to close.
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    if (e.key === 'Escape' && this._isOpen) {
      this.close();
    }
  }

  /**
   * Handle backdrop click to close.
   */
  _handleBackdropClick() {
    this.close();
  }

  /**
   * Open the analytics dashboard panel.
   */
  async open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._previouslyFocused = document.activeElement;

    this._renderContent();

    this._wrapper.classList.add('analytics-wrapper--open');

    requestAnimationFrame(() => {
      this._backdrop.classList.add('analytics-backdrop--visible');
      this._panel.classList.add('analytics-panel--open');
      this._panel.setAttribute('aria-hidden', 'false');
    });

    document.addEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);
    this._focusTrap.activate();

    // Load data
    await Promise.all([
      this._loadSummary(),
      this._loadTabData(this._activeTab),
    ]);
  }

  /**
   * Close the analytics dashboard panel.
   */
  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._focusTrap.deactivate();

    // Destroy chart instances
    if (this._trendsChart) {
      this._trendsChart.destroy();
      this._trendsChart = null;
    }
    if (this._peaksChart) {
      this._peaksChart.destroy();
      this._peaksChart = null;
    }
    if (this._heatmapChart) {
      this._heatmapChart.destroy();
      this._heatmapChart = null;
    }
    if (this._compareChart) {
      this._compareChart.destroy();
      this._compareChart = null;
    }

    this._backdrop.classList.remove('analytics-backdrop--visible');
    this._panel.classList.remove('analytics-panel--open');
    this._panel.setAttribute('aria-hidden', 'true');

    this._wrapper.classList.remove('analytics-wrapper--open');

    document.removeEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.removeEventListener('click', this._boundHandleBackdrop);

    setTimeout(() => {
      if (!this._isOpen) {
        this._panel.innerHTML = '';
      }
    }, 300);

    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
  }

  /**
   * Set the game profile manager (for late initialization).
   * @param {Object} manager - GameProfileManager instance
   */
  setProfileManager(manager) {
    this._gameProfileManager = manager;
  }

  /**
   * Populate the profile filter dropdown.
   */
  async _populateProfileFilter() {
    const select = this._panel.querySelector('#analytics-profile-select');
    if (!select || !this._gameProfileManager) return;

    try {
      const profiles = await this._gameProfileManager.getAllProfiles();
      // Clear existing options except "All Games"
      while (select.options.length > 1) select.remove(1);

      for (const p of profiles) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.icon} ${p.name}`;
        if (p.id === this._selectedProfileId) opt.selected = true;
        select.appendChild(opt);
      }
    } catch (err) {
      console.error('Failed to load profiles for filter:', err);
    }
  }

  /**
   * Refresh the current view (summary + active tab) after filter change.
   */
  async _refreshCurrentView() {
    await Promise.all([
      this._loadSummary(),
      this._loadTabData(this._activeTab),
    ]);
  }

  /**
   * Load and render the game comparison tab.
   */
  async _loadCompare() {
    const container = this._panel.querySelector('#analytics-compare-content');
    if (!container) return;

    if (!this._gameProfileManager) {
      container.innerHTML = `
        <div class="analytics-empty">
          <div class="analytics-empty__icon">\uD83C\uDFAE</div>
          <span class="analytics-empty__text">Game profiles not available</span>
        </div>
      `;
      return;
    }

    try {
      const profiles = await this._gameProfileManager.getAllProfiles();

      if (profiles.length < 2) {
        container.innerHTML = `
          <div class="analytics-empty">
            <div class="analytics-empty__icon">\uD83D\uDCCA</div>
            <span class="analytics-empty__text">Create at least 2 game profiles to compare stats</span>
          </div>
        `;
        return;
      }

      // Gather stats for each profile
      const profileStats = await Promise.all(
        profiles.map(async (p) => {
          const stats = await this._engine.getOverallStats({ profileId: p.id });
          return { profile: p, stats };
        })
      );

      // Render cards
      const cardsHtml = profileStats.map(({ profile, stats }) => {
        const rageColor = getRageColor(stats.overallAvg);
        const ragePct = Math.round((stats.overallAvg / 100) * 100);
        const totalDuration = this._formatDurationShort(stats.totalDuration);

        return `
          <div class="compare-card" style="--compare-accent: ${profile.color}">
            <div class="compare-header">
              <span class="compare-icon">${profile.icon}</span>
              <span class="compare-name">${profile.name}</span>
            </div>
            <div class="compare-stats">
              <div class="stat-row"><span>Sessions</span><span>${stats.totalSessions}</span></div>
              <div class="stat-row"><span>Avg Rage</span><span style="color: ${rageColor}">${Math.round(stats.overallAvg)}</span></div>
              <div class="stat-row"><span>Max Rage</span><span>${stats.worstSession ? Math.round(stats.worstSession.avg) : '--'}</span></div>
              <div class="stat-row"><span>Total Time</span><span>${totalDuration}</span></div>
            </div>
            <div class="compare-bar">
              <div class="compare-bar__fill" style="width: ${ragePct}%; background: ${rageColor}"></div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <h3 class="analytics-section-title">Game Comparison</h3>
        <div class="compare-grid">${cardsHtml}</div>
        <div class="analytics-chart-well" style="margin-top: var(--space-5)">
          <h3 class="analytics-section-title">Average Rage by Game</h3>
          <div class="analytics-chart-container">
            <canvas id="compare-chart"></canvas>
          </div>
        </div>
      `;

      // Render bar chart
      this._renderCompareChart(profileStats);
    } catch (err) {
      console.error('Failed to load comparison data:', err);
      container.innerHTML = `
        <div class="analytics-empty">
          <span class="analytics-empty__text">Unable to load comparison data</span>
        </div>
      `;
    }
  }

  /**
   * Render the comparison bar chart.
   * @param {Array} profileStats
   */
  _renderCompareChart(profileStats) {
    const canvas = this._panel.querySelector('#compare-chart');
    if (!canvas) return;

    if (this._compareChart) {
      this._compareChart.destroy();
      this._compareChart = null;
    }

    const ctx = canvas.getContext('2d');
    this._compareChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: profileStats.map(ps => `${ps.profile.icon} ${ps.profile.name}`),
        datasets: [{
          label: 'Avg Rage',
          data: profileStats.map(ps => Math.round(ps.stats.overallAvg)),
          backgroundColor: profileStats.map(ps => ps.profile.color + '99'),
          borderColor: profileStats.map(ps => ps.profile.color),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutCubic' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(61, 72, 82, 0.92)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 11, weight: '500' },
            padding: 10,
            cornerRadius: 10,
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#9CA3AF',
              font: { family: 'DM Sans', size: 9, weight: 'bold' },
            },
            grid: { color: 'rgba(163, 177, 198, 0.15)' },
            border: { display: false },
          },
          y: {
            ticks: {
              color: '#9CA3AF',
              font: { family: 'DM Sans', size: 11, weight: 'bold' },
            },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    });
  }

  /**
   * Format duration as short human-readable string.
   * @param {number} ms
   * @returns {string}
   */
  _formatDurationShort(ms) {
    if (!ms || isNaN(ms)) return '0s';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${totalSecs}s`;
  }

  /**
   * Remove all DOM and clean up completely.
   */
  destroy() {
    this.close();
    this._wrapper.remove();
  }
}
