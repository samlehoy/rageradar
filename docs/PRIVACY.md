# 🔒 RageRadar — Privacy & Data Handling Policy

> **Your privacy is not a feature — it's a fundamental right.**
>
> RageRadar was built from the ground up with a single, non-negotiable principle: **your data never leaves your device.** Every frame from your webcam, every sound from your microphone, and every emotion score we calculate stays entirely within your browser. No exceptions. No fine print. No compromises.

---

## 📋 Table of Contents

- [Data Collection](#-data-collection)
- [Data Processing](#-data-processing)
- [Data Storage](#-data-storage)
- [Data Retention & Deletion](#-data-retention--deletion)
- [Third-Party Libraries](#-third-party-libraries)
- [No Cloud Transmission](#-no-cloud-transmission)
- [User Consent & Permissions](#-user-consent--permissions)
- [Open Source Transparency](#-open-source-transparency)
- [Contact](#-contact)

---

## 📷 Data Collection

### Camera (Webcam)

| Aspect | Detail |
|---|---|
| **What is accessed** | Live video frames from your webcam |
| **How it's processed** | Each frame is analyzed in real-time by face-api.js for facial expression detection |
| **What is retained** | Only extracted **emotion scores** (numerical values, e.g., `angry: 0.82, happy: 0.03`) |
| **What is NOT retained** | Raw video frames are **NEVER recorded, stored, cached, or transmitted** |
| **Processing lifecycle** | Frame captured → emotion scores extracted → frame immediately discarded from memory |

> [!IMPORTANT]
> RageRadar does **not** record video. The webcam feed is processed frame-by-frame in real-time, and each frame is discarded immediately after emotion scores are extracted. No image data is ever written to disk or sent over the network.

### Microphone (Audio)

| Aspect | Detail |
|---|---|
| **What is accessed** | Live audio stream from your microphone |
| **How it's processed** | Audio is analyzed in real-time using the Web Audio API for **volume levels** (RMS amplitude) and **pitch frequency** only |
| **What is retained** | Only extracted **audio metrics** (numerical values, e.g., `volume: 0.73, pitch: 420Hz`) |
| **What is NOT retained** | Raw audio data is **NEVER recorded, stored, cached, or transmitted** |
| **Processing lifecycle** | Audio buffer captured → volume/pitch metrics extracted → buffer immediately discarded |

> [!IMPORTANT]
> RageRadar does **not** record audio. The microphone stream is analyzed for volume and pitch patterns only. No voice data, speech content, or audio recordings are ever created, stored, or transmitted.

### Session Data

The following metadata is collected and stored **locally** during gaming sessions:

- **Timestamped rage scores** — composite emotion scores at regular intervals (e.g., every second)
- **Session metadata:**
  - Session start time
  - Session end time
  - Session duration
  - Game name (user-provided)
- **Aggregated statistics** — average rage level, peak rage moments, session summary

> [!NOTE]
> Session data consists entirely of **numbers and timestamps**. No raw media (images, audio) is ever part of session data.

---

## ⚙️ Data Processing

**ALL data processing happens 100% locally in your browser.**

```
┌─────────────────────────────────────────────────────┐
│                  YOUR BROWSER                        │
│                                                     │
│  📷 Webcam ──→ face-api.js ──→ Emotion Scores      │
│                  (local ML)     (numbers only)      │
│                                                     │
│  🎤 Mic ────→ Web Audio API ──→ Volume/Pitch       │
│                  (native API)   (numbers only)      │
│                                                     │
│  📊 Scores ──→ Fusion Engine ──→ Rage Score ──→ UI  │
│                  (JavaScript)    (0-100)            │
│                                                     │
│  💾 Storage: IndexedDB + localStorage (local only)  │
│                                                     │
│  🌐 Network calls: ZERO                            │
│  📡 Telemetry: NONE                                │
│  📈 Analytics tracking: NONE                       │
└─────────────────────────────────────────────────────┘
```

- **Machine Learning inference** runs entirely in-browser via JavaScript/WebAssembly
- **Zero server communication** — no HTTP requests, no WebSocket connections, no API calls
- **No telemetry** — we do not track usage patterns, feature adoption, or error rates
- **No analytics** — no Google Analytics, no Mixpanel, no Amplitude, no tracking pixels, nothing

---

## 💾 Data Storage

All data is stored **exclusively on your device** using browser-native storage mechanisms:

### IndexedDB

- **Purpose:** Stores session history (timestamped rage scores, session metadata, aggregated statistics)
- **Location:** Your browser's local IndexedDB database
- **Access:** Only accessible by the RageRadar application running in your browser
- **Encryption:** Protected by your browser's built-in storage security
- **Persistence:** Data persists across browser sessions until you explicitly delete it

### localStorage

- **Purpose:** Stores user settings and preferences (UI theme, alert thresholds, notification preferences, input sensitivity)
- **Location:** Your browser's local localStorage
- **Size:** Minimal footprint (typically < 50KB)

### What is NOT Stored

| Data Type | Stored? |
|---|---|
| Webcam video frames | ❌ **Never** |
| Audio recordings | ❌ **Never** |
| Raw image data | ❌ **Never** |
| Voice/speech content | ❌ **Never** |
| Personal information | ❌ **Never** |
| IP addresses | ❌ **Never** |
| Browser fingerprints | ❌ **Never** |
| Usage analytics | ❌ **Never** |

> [!CAUTION]
> Data **NEVER** leaves your device. There is no cloud sync, no remote backup, no server-side storage of any kind. If you clear your browser data, your RageRadar session history will be permanently deleted.

---

## 🗑️ Data Retention & Deletion

### User Control

You have **full control** over your data at all times:

- **Delete individual sessions** — remove specific gaming sessions from your history
- **Delete all session data** — clear your entire session history with one click
- **Reset preferences** — restore all settings to defaults
- **Clear everything** — complete data wipe (sessions + settings)

### How to Delete Your Data

RageRadar provides a clear, accessible UI for data management:

1. Navigate to **Settings → Data Management**
2. Choose what to delete:
   - 🗂️ Individual sessions
   - 📁 All session history
   - ⚙️ User preferences
   - 🧹 Everything (full reset)
3. Confirm deletion — data is **permanently and irreversibly removed**

### No Automatic Backup

- There is **no automatic cloud backup** of any kind
- There is **no "sync across devices"** feature
- If you uninstall or clear browser data, your RageRadar data is gone permanently
- This is **by design** — your data exists only where you put it

---

## 📦 Third-Party Libraries

RageRadar uses the following third-party libraries, all of which operate **entirely locally**:

### face-api.js

- **Purpose:** Facial expression recognition from webcam frames
- **How it works:** TensorFlow.js-based ML models loaded **locally** into the browser
- **Model files:** Downloaded once and cached locally in the browser
- **Inference:** Runs **entirely in your browser** via JavaScript/WebAssembly
- **Network activity:** **None** — no API calls, no external servers, no cloud inference
- **Data sent externally:** **Nothing** — zero data transmission

### Web Audio API

- **Purpose:** Real-time audio analysis for volume and pitch detection
- **How it works:** Native browser API — built directly into your browser
- **External dependencies:** **None** — no third-party audio processing services
- **Data sent externally:** **Nothing**

### Chart.js

- **Purpose:** Rendering session timeline charts and rage history visualizations
- **How it works:** Client-side rendering **only** — charts are drawn directly in your browser
- **External dependencies:** **None** for core rendering
- **Data sent externally:** **Nothing**

> [!NOTE]
> All third-party libraries are bundled with the application. After the initial page load, RageRadar requires **zero network connectivity** to function.

---

## 🚫 No Cloud Transmission

> **EXPLICIT DECLARATION:**
>
> RageRadar does **NOT** transmit any of the following to any server, cloud service, API endpoint, or third party — under any circumstances:
>
> - ❌ Webcam video frames or image data
> - ❌ Microphone audio data or voice recordings
> - ❌ Facial expression scores or emotion data
> - ❌ Audio volume levels or pitch data
> - ❌ Composite rage scores
> - ❌ Session history or metadata
> - ❌ User settings or preferences
> - ❌ Usage analytics or telemetry
> - ❌ Error reports or crash data
> - ❌ Personal information of any kind
>
> **There is no server.** RageRadar is a purely client-side application. There is no backend to send data to, even if we wanted to (which we don't).

---

## ✅ User Consent & Permissions

### Permission Flow

RageRadar requires access to your **camera** and **microphone** through standard browser permission dialogs:

1. **Camera Permission**
   - Requested via the browser's native permission dialog
   - Used **exclusively** for real-time facial expression analysis
   - Can be revoked at any time through browser settings

2. **Microphone Permission**
   - Requested via the browser's native permission dialog
   - Used **exclusively** for real-time volume and pitch analysis
   - Can be revoked at any time through browser settings

### Clear Explanations

Before requesting permissions, RageRadar provides:

- A clear explanation of **what** each permission is used for
- A clear explanation of **how** data is processed (locally, in real-time)
- A clear statement that **no data is recorded or transmitted**
- The ability to use RageRadar with only one input (camera only or microphone only)

### Revoking Permissions

You can revoke camera and/or microphone permissions at any time:

- **In-app:** Use the toggle switches in the RageRadar interface to disable camera/microphone input
- **Browser settings:** Revoke permissions through your browser's site settings
- **Effect:** RageRadar will gracefully degrade — the rage meter will use only the available input sources

---

## 🔓 Open Source Transparency

RageRadar is **open source**. You don't have to take our word for any of the above — you can verify it yourself:

- **Audit the source code** — every line of code is publicly available
- **Inspect network activity** — open your browser's DevTools Network tab and confirm zero outbound requests
- **Review the build** — the entire build pipeline is transparent and reproducible
- **Read the dependencies** — all third-party packages are listed in `package.json`

We believe that privacy claims without transparency are meaningless. That's why everything is open for inspection.

---

## 📬 Contact

If you have questions, concerns, or suggestions about this privacy policy or RageRadar's data handling practices:

- **GitHub Issues:** [Open an issue](https://github.com/yourusername/rageradar/issues)
- **Email:** `privacy@rageradar.app` *(placeholder — update with actual contact)*
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/rageradar/discussions)

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

*Last updated: July 2026*
*This privacy policy applies to RageRadar v1.x and later.*
