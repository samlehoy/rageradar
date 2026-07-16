/**
 * Session Timeline — real-time scrolling line chart.
 * Renders rage score over a rolling 2-minute window using Chart.js v4.
 */
import { Chart } from 'chart.js/auto';
import { eventBus } from '../utils/event-bus.js';
import { getRageColor } from '../utils/rage-levels.js';

/** Max data points on the chart (120s / 1s refresh = 120 points). */
const MAX_POINTS = 120;

export class SessionTimeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   * @param {Array<RageScore>} [options.historicalData]
   */
  constructor(canvas, options = {}) {
    this._canvas = canvas;
    this._latestScore = 0;
    this._chart = null;
    this._options = options;

    this._createChart();

    if (options.historicalData && options.historicalData.length > 0) {
      this._loadHistoricalData(options.historicalData);
    } else {
      this._subscribe();
      // Start 1-second interval for real-time scrolling
      this._timer = setInterval(() => this._tick(), 1000);
    }
  }

  /**
   * Build and render the Chart.js real-time chart.
   */
  _createChart() {
    const ctx = this._canvas.getContext('2d');
    const now = Date.now();

    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Rage Score',
            data: [],
            borderColor: getRageColor(0),
            backgroundColor: (context) => {
              const chart = context.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              if (!chartArea) return null;
              const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(108, 99, 255, 0.22)');
              gradient.addColorStop(1, 'rgba(108, 99, 255, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.42,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6C63FF',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5,
          },
          {
            label: 'Threshold',
            data: [],
            borderColor: 'rgba(163, 177, 198, 0.5)',
            borderDash: [6, 6],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
          }
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !!this._options.historicalData,
            callbacks: {
              title(context) {
                const val = context[0].parsed.x;
                return new Date(val).toLocaleTimeString();
              },
              label(context) {
                return `Rage Score: ${context.parsed.y}`;
              }
            }
          },
          decimation: {
            enabled: true,
            algorithm: 'lttb',
            samples: 200,
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: now - 120000,
            max: now,
            ticks: {
              display: true,
              maxTicksLimit: 6,
              color: '#9CA3AF',
              font: {
                family: 'DM Sans',
                size: 9,
                weight: 'bold',
              },
              callback(value) {
                const date = new Date(value);
                const mins = String(date.getMinutes()).padStart(2, '0');
                const secs = String(date.getSeconds()).padStart(2, '0');
                return `${mins}:${secs}`;
              },
            },
            grid: {
              color: 'rgba(163, 177, 198, 0.15)',
            },
            border: {
              display: false,
            },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#9CA3AF',
              font: {
                family: 'DM Sans',
                size: 9,
                weight: 'bold',
              },
              callback(value) {
                const labels = { 0: '0', 20: '20', 40: '40', 60: '60', 80: '80', 100: '100' };
                return labels[value] ?? '';
              },
            },
            grid: {
              color: 'rgba(163, 177, 198, 0.15)',
            },
            border: {
              display: false,
            },
          },
        },
      },
    });
  }

  /**
   * 1-second interval tick to push data and scroll chart.
   */
  _tick() {
    if (!this._chart) return;

    const now = Date.now();
    const minTime = now - 120000;

    // Push new data points
    this._chart.data.datasets[0].data.push({ x: now, y: this._latestScore });
    this._chart.data.datasets[1].data.push({ x: now, y: 60 });

    // Prune data older than 2 minutes
    this._chart.data.datasets.forEach((ds) => {
      ds.data = ds.data.filter((pt) => pt.x >= minTime);
    });

    // Update dataset border color dynamically
    this._chart.data.datasets[0].borderColor = getRageColor(this._latestScore);

    // Shift the x-axis scale limits
    this._chart.options.scales.x.min = minTime;
    this._chart.options.scales.x.max = now;

    this._chart.update('none');
  }

  /**
   * Subscribe to fusion:score events and cache the latest score.
   */
  _subscribe() {
    this._unsub = eventBus.on('fusion:score', (data) => {
      this._latestScore = data.smoothed ?? data.raw ?? 0;
    });
  }

  _loadHistoricalData(points) {
    if (!this._chart) return;

    const dataset = this._chart.data.datasets[0];
    const thresholdDs = this._chart.data.datasets[1];

    dataset.data = points.map(pt => ({ x: pt.timestamp, y: pt.smoothed }));
    thresholdDs.data = points.map(pt => ({ x: pt.timestamp, y: 60 }));

    if (points.length > 0) {
      const firstTime = points[0].timestamp;
      const lastTime = points[points.length - 1].timestamp;

      this._chart.options.scales.x.min = firstTime;
      this._chart.options.scales.x.max = lastTime;
    }

    // Update dataset border color dynamically
    const avgScore = points.reduce((acc, p) => acc + p.smoothed, 0) / (points.length || 1);
    dataset.borderColor = getRageColor(avgScore);

    this._chart.update();
  }

  /**
   * Reset chart data and internal state.
   */
  reset() {
    if (this._chart) {
      this._chart.data.datasets.forEach((ds) => (ds.data = []));
      this._chart.update('none');
    }
    this._latestScore = 0;
  }

  /**
   * Tear down event subscription, interval timer, and destroy chart instance.
   */
  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._unsub?.();
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }
  }
}
