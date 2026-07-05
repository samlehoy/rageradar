import './styles/main.css';
import { RageMeter } from './ui/rage-meter.js';
import { SessionTimeline } from './ui/timeline.js';
import { FusionEngine } from './modules/fusion.js';
import { AlertSystem } from './modules/alerts.js';
import { ToastManager } from './ui/toast.js';
import { SettingsPanel } from './ui/settings.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="dashboard" role="main">
    <div class="dashboard-column dashboard-column--primary">
      <div id="meter-container"></div>
    </div>
    <div class="dashboard-column dashboard-column--secondary">
      <div class="timeline-panel" id="timeline-container">
        <div class="timeline-header">
          <h2 class="timeline-title">Rage Timeline</h2>
          <span class="timeline-stats">LIVE</span>
        </div>
        <div class="timeline-chart-wrapper">
          <canvas id="timeline-canvas"></canvas>
        </div>
      </div>
    </div>
  </main>
`;

const meterContainer = document.querySelector('#meter-container');
const meter = new RageMeter(meterContainer);

const timelineCanvas = document.querySelector('#timeline-canvas');
const timeline = new SessionTimeline(timelineCanvas);

// Alert system and toast notifications
const alerts = new AlertSystem();
const toasts = new ToastManager();

// Settings panel
const settings = new SettingsPanel();
window.__settings = settings;

// Expose settings toggle globally (can be wired to a button later)
window.toggleSettings = () => settings.toggle();

// Expose for dev console testing
window.__meter = meter;
window.__timeline = timeline;
window.__alerts = alerts;
window.__toasts = toasts;
window.__settingsPanel = settings;

// Optional: start engine if camera available
if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
  const engine = new FusionEngine();
  window.__engine = engine;
}
