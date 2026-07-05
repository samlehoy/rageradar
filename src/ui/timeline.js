/**
 * Session Timeline — real-time scrolling line chart.
 * Renders rage score over a rolling 2-minute window using Chart.js
 * + chartjs-plugin-streaming v2.0.0.
 */
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import 'chartjs-adapter-luxon';
import StreamingPlugin from 'chartjs-plugin-streaming';
Chart.register(StreamingPlugin);

import { eventBus } from '../utils/event-bus.js';
import { getRageColor } from '../utils/rage-levels.js';

/** Max data points on the chart (120s / 1s refresh = 120 points). */
const MAX_POINTS = 120;

export class SessionTimeline {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._latestScore = 0;
    this._chart = null;

    this._createChart();
    this._subscribe();
  }

  /**
   * Build and render the Chart.js real-time chart.
   */
  _createChart() {
    const ctx = this._canvas.getContext('2d');

    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Rage Score',
            data: [],
            borderColor: () => getRageColor(this._latestScore),
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          streaming: {
            duration: 120000,        // 2-minute rolling window
            refresh: 1000,            // 1-second tick
            delay: 500,               // 500ms lag to allow data to arrive
            onRefresh: (chart) => {
              const now = Date.now();
              chart.data.datasets.forEach((dataset) => {
                dataset.data.push({
                  x: now,
                  y: this._latestScore,
                });
                // Keep only the latest N points within the window
                while (dataset.data.length > MAX_POINTS) {
                  dataset.data.shift();
                }
              });
            },
          },
        },
        scales: {
          x: {
            type: 'realtime',
            realtime: {
              duration: 120000,
              refresh: 1000,
              delay: 500,
              onRefresh: null, // handled at plugin level above
            },
            ticks: {
              display: true,
              maxTicksLimit: 6,
              color: '#64748b',
              font: { size: 10 },
            },
            grid: {
              color: 'rgba(30, 30, 58, 0.6)',
              drawBorder: false,
            },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#64748b',
              font: { size: 10 },
              callback(value) {
                const labels = { 0: '0', 20: '20', 40: '40', 60: '60', 80: '80', 100: '100' };
                return labels[value] ?? '';
              },
            },
            grid: {
              color: 'rgba(30, 30, 58, 0.6)',
              drawBorder: false,
            },
          },
        },
      },
    });
  }

  /**
   * Subscribe to fusion:score events and cache the latest score.
   */
  _subscribe() {
    this._unsub = eventBus.on('fusion:score', (data) => {
      this._latestScore = data.smoothed ?? data.raw ?? 0;
    });
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
   * Tear down event subscription and destroy chart instance.
   */
  destroy() {
    this._unsub?.();
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }
  }
}
