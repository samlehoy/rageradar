import './styles/main.css';
import { RageMeter } from './ui/rage-meter.js';
import { FusionEngine } from './modules/fusion.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="dashboard" role="main">
    <div id="meter-container"></div>
  </main>
`;

const meterContainer = document.querySelector('#meter-container');
const meter = new RageMeter(meterContainer);

// Expose for dev console testing
window.__meter = meter;

// Optional: start engine if camera available
if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
  const engine = new FusionEngine();
  window.__engine = engine;
}
