<div align="center">

# 🎯 RageRadar

### *Real-time emotion detection for gamers — know your tilt before it costs you the game*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)]()
[![Version](https://img.shields.io/badge/version-1.0.0--alpha-blue?style=flat-square)]()
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)]()
[![Privacy](https://img.shields.io/badge/privacy-100%25_local-purple?style=flat-square)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)]()

---

**RageRadar uses your webcam and microphone to detect rising frustration in real-time while you game.** It tracks your facial expressions, voice volume, and pitch patterns — all processed entirely in your browser — to give you a live "rage score" from 0 to 100. When your tilt starts climbing, RageRadar alerts you before it spirals into a rank-destroying meltdown. Think of it as a fitness tracker, but for your mental game.

[Get Started](#-quick-start) · [Features](#-features) · [How It Works](#-how-it-works) · [Privacy](#-privacy) · [Contributing](docs/CONTRIBUTING.md)

</div>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 📸 | **Facial Expression Analysis** | Real-time detection of 7 emotions (anger, disgust, fear, happiness, sadness, surprise, neutral) powered by face-api.js machine learning models |
| 🎤 | **Voice & Volume Detection** | Monitors vocal intensity (RMS volume) and pitch frequency via the Web Audio API — catches yelling, sighing, and tense silence |
| 🔥 | **Real-time Rage Meter** | Live 0–100 composite score combining face + voice data, updated multiple times per second with smooth animations |
| 📊 | **Session Timeline & History** | Interactive charts showing your emotional journey throughout each gaming session, with historical data stored locally |
| 🔔 | **Smart Alerts & Notifications** | Configurable sound and visual alerts when your rage crosses thresholds — catch the tilt before it catches you |
| 🔒 | **100% Local Processing** | Every computation happens in your browser. No servers, no cloud, no data leaves your device. Ever. [Read our Privacy Policy →](docs/PRIVACY.md) |

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| ⚡ Build | **Vite** | Lightning-fast dev server & build tool |
| 📜 Language | **Vanilla JavaScript** (ES Modules) | Zero-framework, maximum performance |
| 🧠 Face Detection | **face-api.js** | TensorFlow.js-based facial expression recognition |
| 🎙️ Audio Analysis | **Web Audio API** | Native browser API for real-time audio processing |
| 📈 Charts | **Chart.js** | Beautiful, responsive session timeline charts |
| 💾 Storage | **IndexedDB** (via idb) | Local session history & data persistence |
| 🧪 Testing | **Vitest** | Fast, Vite-native unit & integration testing |
| 🎨 Styling | **Vanilla CSS** | Custom properties, animations, zero dependencies |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Modern browser** (Chrome, Firefox, or Edge — latest version)
- **Webcam** + **Microphone** (built-in or USB)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/rageradar.git

# Navigate to the project
cd rageradar

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser. Allow camera and microphone access when prompted. Start gaming. 🎮

---

## 🧠 How It Works

RageRadar operates on a simple three-step pipeline — all running locally in your browser:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. DETECT  │────▶│  2. ANALYZE  │────▶│   3. ALERT   │
│              │     │              │     │              │
│ 📸 Webcam    │     │ 🔥 Fusion    │     │ 🔔 Threshold │
│ captures     │     │ Engine       │     │ triggers     │
│ facial       │     │ combines     │     │ sound &      │
│ expressions  │     │ face + voice │     │ visual       │
│              │     │ into a       │     │ alerts when  │
│ 🎤 Mic       │     │ composite    │     │ rage is      │
│ captures     │     │ rage score   │     │ rising       │
│ voice data   │     │ (0-100)      │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

1. **Detect** — Your webcam and microphone feed are analyzed in real-time. Face-api.js extracts emotion scores from facial expressions. The Web Audio API measures vocal volume and pitch.

2. **Analyze** — The Fusion Engine combines facial and vocal data using configurable weights (default: 60% face, 40% voice) to produce a single composite rage score from 0 to 100.

3. **Alert** — When your rage score crosses configurable thresholds, RageRadar triggers sound alerts and visual notifications to help you recognize and manage tilt before it impacts your gameplay.

---

## 🌡️ Rage Scale

| Level | Score | Emoji | Color | Description |
|---|---|---|---|---|
| **Chill** | 0–20 | 😌 | 🟢 Green | You're cool, calm, and collected. Peak performance zone. |
| **Focused** | 21–40 | 😐 | 🔵 Blue | Slight tension detected. Competitive focus is kicking in. |
| **Heated** | 41–60 | 😤 | 🟡 Yellow | Frustration is building. Consider a micro-break. |
| **Tilted** | 61–80 | 😡 | 🟠 Orange | You're tilting hard. Performance is likely dropping. |
| **Full Rage** | 81–100 | 🤬 | 🔴 Red | Maximum tilt detected. Step away. Breathe. Hydrate. |

---

## 📂 Project Structure

```
rageradar/
├── public/
│   └── models/              # face-api.js ML model files
├── src/
│   ├── modules/             # Core logic
│   │   ├── faceDetector.js      # Webcam + face-api.js
│   │   ├── audioAnalyzer.js     # Mic + Web Audio API
│   │   ├── fusionEngine.js      # Face + Audio → Rage Score
│   │   ├── sessionManager.js    # Session lifecycle
│   │   └── alertSystem.js       # Alert triggers
│   ├── ui/                  # UI components
│   │   ├── rageMeter.js         # Rage meter display
│   │   ├── timeline.js          # Session timeline
│   │   └── settings.js          # Settings panel
│   ├── utils/               # Shared utilities
│   │   ├── constants.js         # App-wide constants
│   │   ├── storage.js           # IndexedDB/localStorage
│   │   └── helpers.js           # General utilities
│   ├── styles/              # Stylesheets
│   │   ├── index.css            # Main styles + tokens
│   │   ├── components.css       # Component styles
│   │   └── animations.css       # Animations
│   ├── main.js              # App entry point
│   └── index.html           # HTML shell
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── docs/
│   ├── PRIVACY.md           # Privacy & data handling policy
│   └── CONTRIBUTING.md      # Contribution guidelines
├── package.json
├── vite.config.js
├── vitest.config.js
└── README.md                # You are here
```

---

## 🗺️ Roadmap

### Phase 1: MVP 🚧 *(Current)*

- [x] Project scaffolding (Vite + Vanilla JS)
- [ ] Webcam integration with face-api.js
- [ ] Microphone integration with Web Audio API
- [ ] Fusion Engine (composite rage scoring)
- [ ] Real-time Rage Meter UI
- [ ] Session timeline with Chart.js
- [ ] Sound alerts & notifications
- [ ] Session history (IndexedDB)
- [ ] Settings panel (thresholds, weights, sensitivity)
- [ ] Privacy-first data handling

### Phase 2: Enhanced Features 🔮

- [ ] **Rage Clips** — auto-capture highlights around peak rage moments
- [ ] **Advanced Analytics** — trends, patterns, per-game breakdowns
- [ ] **Cooldown Tips** — personalized suggestions when tilt is detected
- [ ] **Multi-Game Profiles** — separate settings and history per game
- [ ] **Customizable UI Themes** — dark, light, OLED, custom colors
- [ ] **Export Data** — download your session data (JSON/CSV)

### Phase 3: Desktop & Overlay 🖥️

- [ ] **Electron/Tauri Desktop App** — native desktop experience
- [ ] **Game Overlay** — in-game rage meter overlay (non-intrusive)
- [ ] **Global Hotkeys** — start/stop sessions without alt-tabbing
- [ ] **System Tray Integration** — background monitoring with tray icon
- [ ] **Multi-Monitor Support** — overlay on any screen

---

## 🤝 Contributing

We love contributions! Whether it's a bug report, feature request, or code contribution — every bit helps.

Please read our **[Contributing Guide](docs/CONTRIBUTING.md)** for details on:

- Development setup and workflow
- Code style and naming conventions
- Testing requirements (TDD-first approach)
- Pull request process and review checklist

> Looking for a good first issue? Check the [`good first issue`](https://github.com/yourusername/rageradar/issues?q=label%3A%22good+first+issue%22) label.

---

## 🔒 Privacy

**RageRadar processes everything locally.** Your webcam and microphone data never leave your browser — not even for a millisecond. No servers, no cloud, no telemetry, no analytics. This is a fundamental design principle, not a feature toggle.

📄 Read the full **[Privacy & Data Handling Policy →](docs/PRIVACY.md)**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 RageRadar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

RageRadar is built on the shoulders of incredible open-source projects:

- **[face-api.js](https://github.com/justadudewhohacks/face-api.js)** — JavaScript face detection and recognition API built on TensorFlow.js
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)** — Native browser API for real-time audio processing and analysis
- **[Chart.js](https://www.chartjs.org/)** — Simple yet flexible JavaScript charting library
- **[Vite](https://vitejs.dev/)** — Next-generation frontend build tool
- **[Vitest](https://vitest.dev/)** — Blazing-fast unit testing framework powered by Vite
- **[idb](https://github.com/jakearchibald/idb)** — Tiny IndexedDB wrapper with usability improvements

---

## 📌 Development Reference

> **RTK & Context7 Policy**
>
> This project mandates the use of **RTK** (Rust Token Killer) for all CLI operations to optimize token usage (60-90% savings on dev operations). Always prefix commands through RTK hooks.
>
> **Context7** must be used as the primary source for up-to-date library documentation, best practices, and code examples before implementing any library integration. Query Context7 with `resolve-library-id` → `query-docs` workflow for:
> - face-api.js (`/justadudewhohacks/face-api.js`)
> - MediaPipe (`/google-ai-edge/mediapipe`)
> - Web Audio API (`/websites/webaudio_github_io_web-audio-api`)
> - Any other libraries added to the stack
>
> **No library integration should begin without first consulting Context7 for the latest API patterns and best practices.**

---

<div align="center">

**Built with 🎮 for gamers, by gamers.**

*Stop raging. Start winning.*

</div>
