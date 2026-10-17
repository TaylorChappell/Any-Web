# 0.4.4 — Captions off

- Removed ANY’s subtitle button and track picker.
- Native video and Vidstack caption tracks remain disabled, including tracks added or re-enabled after playback starts.
- Hides the separate caption overlays used by Movish and common player frameworks, plus their caption controls. Saved subtitle preferences no longer enable captions.
- Playback position, audio, Together synchronization and source selection are preserved.
- Captions burned into the picture cannot be removed. The browser website cannot force changes inside an unsupported cross-origin provider iframe; this native enforcement requires the updated desktop app.

# ANY Desktop 0.4.3

- Hold left or right to seek faster over time. A tap still moves ten seconds; the timeline previews your position and applies one seek when you release. Reversing direction resets the speed.
- Series cast and creators now follow the episode list.
- A compact Series ongoing, Series cancelled or Series ended label sits below the language. The old remaining-episode status line is removed.
- Each unreleased episode keeps its own announced release date, or Date to be announced.
- Includes the previous release's profile notification bell, New episode / New season badges and per-show alert settings.

The TV companion release is 0.3.3-preview. No new backend variables or API keys are needed.
