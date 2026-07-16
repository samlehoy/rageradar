# Changelog

All notable changes to RageRadar are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-07-16

### Added — Phase 1 MVP
- **Camera Module** — face-api.js webcam expression detection (7 emotions)
- **Microphone Module** — Web Audio API volume/pitch analysis
- **Fusion Engine** — Weighted score (0-100) with EMA smoothing + momentum
- **Rage Meter** — SVG radial gauge with dynamic glow + needle animation
- **Session Timeline** — Chart.js real-time scrolling line chart with LTTB decimation
- **Webcam Preview** — Live video with face detection canvas overlay
- **Session Controls** — Start/Stop/Pause with gaming-style buttons
- **Alert System** — Threshold monitoring, toast notifications, 3 audio alert types
- **Session Manager** — IndexedDB persistence, auto-save every 5s, stats computation
- **Session History** — Slide-in panel, session cards with sparklines, detail view
- **Session Summary Modal** — End-of-session stats, zone breakdown, save/discard
- **Settings Panel** — Slide-in panel with sliders, toggles, localStorage persistence
- **Toast Notifications** — Stackable toasts with error variant
- **Mobile Menu** — Hamburger menu for compact viewports

### Added — Phase 1.5 Polish
- **Error Handling** — Camera/mic error toasts with permission-specific guidance
- **Accessibility** — Focus traps in all modals, skip-to-content link, Escape key support
- **Responsive** — Compact mode (≤480px), tablet mode (641-1023px)
- **Performance** — Chart.js LTTB decimation for long session timelines
- **Testing** — 180 tests across 12 test files (Vitest + jsdom)

### Documentation
- Reorganized docs/ folder — archived outdated files, merged overlapping content
- Updated ARCHITECTURE.md as canonical architecture reference
