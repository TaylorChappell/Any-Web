# Validation — 12 October 2026 · Web 0.2.3

- Production Vite build succeeds using the existing ANY frontend token. The token is public only in the compiled deployment; editable source, tests and workflow contain no real credential.
- All 15 frontend tests pass, including the title trailer dialog, three-page category deduplication, MCU season/release filtering, enabling older TV invitations, explicit group source-switch confirmation and normal party-player navigation.
- Backend: all 19 tests pass, including MCU authentication and bounded metadata loading, real two-client WebSocket commands, source changes retaining episode/position/membership, stale epoch rejection, shared persistence and APK publishing.
- Android companion: all 70 host tests pass and the optimized release builds. Native franchise focus was rendered at TV dimensions and inspected.
- Existing root-file GitHub Pages hosting is preserved. Editable web source is in app/. The workflow builds from the repository variable ANY_API_TOKEN. The current compiled site does not require visitors to enter an access code.

- GitHub Pages workflow 38268882632 completed successfully using the existing repository variable. The live site at https://taylorchappell.github.io/Any-Web/ serves the exact locally built JavaScript (index-BUXpEqMc.js). Automatic connection displayed the existing shared profiles without a code-entry prompt.

## Limits

UI/protocol tests use mocked provider events. Actual third-party video decoding, browser autoplay and synchronized playback between a real TV and browser still need a device check. Source 6 has no integrated browser control API, so an older Source 6 invitation asks to switch the group to VidFast or VidCore before joining. A player is ready only after validated live telemetry, never merely because its iframe loaded.

MCU membership is curated; TMDB provides release dates, seasons, descriptions and images. Future or undated entries are hidden. Dates describe metadata, not streaming availability. Earlier connected Marvel series have a separate filter and are not presented as a definitive canon classification.

## Device check

Open the website, select a profile and inspect Collections → MCU. Open a season and check the selected season. Use the trailer icon on a title. Invite another profile, join from TV/browser, allow playback if the browser asks, then check pause, seek and an episode change.
