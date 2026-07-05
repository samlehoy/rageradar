# RageRadar

Real-time emotion detection for gamers — know your tilt before it costs you the game.

RageRadar uses your webcam and microphone to detect rising frustration in real-time while you game. It tracks your facial expressions, voice volume, and pitch patterns — all processed entirely in your browser — to give you a live composite "rage score" from 0 to 100. When your tilt starts climbing, RageRadar alerts you before it spirals into a rank-destroying meltdown.

This application is designed as a single-window viewport-locked dashboard for desktop screens, presenting a clean console layout with responsive sizing, a custom neumorphic interface, and zero external server dependencies.

---

## Features

- **Facial Expression Analysis:** Real-time detection of 7 emotions (anger, disgust, fear, happiness, sadness, surprise, neutral) powered by face-api.js machine learning models.
- **Voice & Volume Detection:** Monitors vocal intensity (RMS volume) and pitch frequency via the Web Audio API to catch yelling, sighing, or tensed patterns.
- **Real-Time Rage Meter:** Live 0–100 composite score combining face and voice data, updated multiple times per second using a responsive SVG radial gauge.
- **Continuous Session Timeline:** Interactive charts showing your emotional journey throughout each session, using a manual rolling time-window in Chart.js.
- **Smart Alerts:** Configurable sound and visual indicators triggered when your rage score crosses custom thresholds.
- **Privacy First:** Every computation happens strictly in your browser. Camera and microphone data are processed locally and never uploaded to any server.

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Build Tool | Vite | Fast developer server and production bundler |
| Language | Vanilla JavaScript (ES Modules) | Standard compliant, zero-framework runtime |
| ML Inference | face-api.js | TensorFlow.js-based facial expression recognition |
| Audio Processing | Web Audio API | Real-time voice feature extraction |
| Charts | Chart.js v4 | Data visualization for rolling session history |
| Local Storage | IndexedDB (via idb) | Local history and configuration persistence |
| Styling | CSS (Tailwind CSS CDN) | Custom neumorphic style system with layered shadows |
| Testing | Vitest | Vite-native unit and integration tests |

---

## Neumorphic Design Implementation

RageRadar is built using Soft UI (Neumorphism) principles tailored for real-time dashboards:
- **Palette:** A warm monochrome palette using a custom clay background (`#E0E5EC`).
- **Layered Shadows:** Outer shadows are stacked (combining a tight, sharp shadow with a wide, soft ambient shadow) to create smooth, natural gradients that prevent muddy borders.
- **Tactile States:** Inactive status chips are rendered raised, sinking into a pressed (inset) state when active. Controls buttons utilize glowing borders for primary actions and sunken inset shadows for disabled states.
- **Viewport Lock:** Locked to the desktop viewport (`1024px` and above) to present all elements in a single dashboard screen without page-level scrollbars, using internal scrolling for long lists.

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- A modern browser (Chrome, Firefox, Safari, or Edge)
- A webcam and microphone

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/samlehoy/rageradar.git
   cd rageradar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Run the test suite:
   ```bash
   npm test
   ```

---

## Project Structure

```
rageradar/
├── dist/                  # Production build output
├── public/                # Static assets (including face-api.js ML models)
├── src/
│   ├── modules/           # Core audio/visual logic
│   │   ├── alertSystem.js      # Threshold indicators and audio alerts
│   │   ├── audioAnalyzer.js    # Mic capture and vocal processing
│   │   ├── faceDetector.js     # Webcam stream and ML expression analysis
│   │   ├── fusionEngine.js     # Multimodal integration of face + audio
│   │   └── sessionManager.js   # Session lifecycle and database logging
│   ├── ui/                # UI rendering modules
│   │   ├── controls.js         # Neumorphic start/stop control deck
│   │   ├── rageMeter.js        # SVG radial gauge and status chips
│   │   ├── settings.js         # Slide-over configurator panel
│   │   └── timeline.js         # Rolling timeline chart
│   ├── utils/             # Helper utilities
│   │   ├── constants.js        # Global configuration constraints
│   │   ├── eventBus.js         # Pub-sub communication
│   │   ├── helpers.js          # General display functions
│   │   ├── rage-levels.js      # Rage scoring thresholds
│   │   └── storage.js          # IndexedDB wrappers
│   ├── styles/            # CSS stylesheets
│   │   ├── tokens.css          # Core CSS variables and palette
│   │   ├── main.css            # Base layouts and utility classes
│   │   └── neu.css             # Soft UI shadow styles
│   ├── main.js            # App bootstrap script
│   └── index.html         # Application shell
├── tests/                 # Unit and integration test suites
└── wrangler.toml          # Cloudflare Workers configuration
```

---

## Deployment

RageRadar is configured for static asset hosting on Cloudflare Workers using Wrangler:

```bash
npx wrangler deploy
```

Deployment routes and configurations are defined in `wrangler.toml` and served via `src/worker.js`.

---

## Development Guidelines

- **TDD Workflow:** Standard implementation follows a test-driven development cycle. All core features should have corresponding tests in the `tests/` directory.
- **Git Rules:** The `.gitignore` excludes documentation, metadata, and local agent configuration directories. Do not commit these files to the repository.
- **RTK Proxying:** All developer operations (testing, building, deployment) should be executed through the token-optimized RTK proxy to maintain efficiency.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
