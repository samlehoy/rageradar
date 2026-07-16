/**
 * Heatmap Chart Component.
 * GitHub contribution-style calendar heatmap using chartjs-chart-matrix.
 * Displays daily average rage scores in a 7-column (Mon–Sun) grid.
 */
import { Chart } from 'chart.js/auto';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

Chart.register(MatrixController, MatrixElement);

/**
 * Map a rage score (0–100) to a heatmap color.
 * @param {number|null} value - Average rage score
 * @returns {string} CSS color
 */
function getRageHeatmapColor(value) {
  if (value === 0 || value == null) return 'rgba(0,0,0,0.05)'; // no data
  if (value <= 20) return '#22c55e';  // calm - green
  if (value <= 40) return '#84cc16';  // focused - lime
  if (value <= 60) return '#eab308';  // tense - yellow
  if (value <= 80) return '#f97316';  // angry - orange
  return '#ef4444';                    // rage - red
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class HeatmapChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._chart = null;
  }

  /**
   * Render heatmap data from analyticsEngine.getHeatmapData().
   * @param {Array<{date: string, dayOfWeek: number, weekIndex: number, avg: number, sessions: number}>} data
   */
  render(data) {
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }

    if (!data || data.length === 0) return;

    const maxWeek = Math.max(...data.map(d => d.weekIndex));

    const ctx = this._canvas.getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'matrix',
      data: {
        datasets: [{
          label: 'Rage Heatmap',
          data: data.map(d => ({
            x: d.weekIndex + 1,
            y: d.dayOfWeek + 1,
            v: d.avg,
            date: d.date,
            sessions: d.sessions,
          })),
          backgroundColor(context) {
            const point = context.dataset.data[context.dataIndex];
            return point ? getRageHeatmapColor(point.v) : 'rgba(0,0,0,0.05)';
          },
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          borderRadius: 3,
          width: ({ chart }) => {
            const { chartArea } = chart;
            if (!chartArea) return 10;
            return (chartArea.right - chartArea.left) / (maxWeek + 2) - 2;
          },
          height: ({ chart }) => {
            const { chartArea } = chart;
            if (!chartArea) return 10;
            return (chartArea.bottom - chartArea.top) / 8 - 2;
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
          easing: 'easeOutCubic',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              title(context) {
                const raw = context[0].raw;
                return raw.date || '';
              },
              label(context) {
                const raw = context.raw;
                if (raw.v === 0 || raw.v == null) return 'No data';
                return [
                  `Avg Rage: ${Math.round(raw.v)}`,
                  `Sessions: ${raw.sessions}`,
                ];
              },
            },
            backgroundColor: 'rgba(61, 72, 82, 0.92)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 11, weight: '500' },
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
          },
        },
        scales: {
          x: {
            type: 'linear',
            position: 'top',
            min: 0.5,
            max: maxWeek + 1.5,
            display: false,
            grid: { display: false },
          },
          y: {
            type: 'linear',
            min: 0.5,
            max: 7.5,
            reverse: false,
            ticks: {
              stepSize: 1,
              callback(value) {
                return DAY_LABELS[value - 1] || '';
              },
              color: '#9CA3AF',
              font: {
                family: 'DM Sans',
                size: 10,
                weight: 'bold',
              },
            },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    });
  }

  /**
   * Destroy the chart instance and clean up.
   */
  destroy() {
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }
  }
}
