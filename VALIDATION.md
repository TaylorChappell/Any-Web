# Web 0.2.7 — 12 October 2026

- Joining automatically requests provider autoplay and sends play on mount/load and after the validated control handshake. Dropped play commands are retried for a bounded period. There is no mandatory local startup button.
- Provider loading has a separate 45-second deadline; startup verification has 20 seconds after a control response. A late handshake or first media arrival automatically resumes the check. Persistent failures do not loop or pretend to be ready.
- Zero-duration status is accepted as a control handshake only. Readiness still requires actual advancing playback followed by pause and position acknowledgement. Seek commands use integer seconds as documented by VidFast.
- Failure messages distinguish no provider connection, no media, play that did not advance, ignored alignment and stalled playback. They do not claim autoplay blocking without evidence.
- 27 web tests pass, including automatic startup, dropped-command retry, loading grace, missing media, late arrival, room command isolation and source switching. These use controlled provider events, not live video decoding.
- Live check: VidFast and VidCore remained on their fetching screens with their documented autoPlay=true URLs. VidFast's own homepage demo displayed “Please Disable Sandbox” even though its visible iframe had no sandbox attribute. ANY also does not set a sandbox attribute. No browser protections were changed.
- Neither provider reached a playable video in this cloud browser. This does not establish an outage on the user's network. A TV/web device test is still required before calling a source verified.
- Production build uses the existing frontend variable. No backend variable or APK change is needed for this web startup fix.

## Device check for 0.2.7

Refresh ANY and join with a different profile from the TV. The startup check should run automatically and return the video to the paused party position. Play on TV; check actual moving video on both devices, pause, seek and episode change. If the source remains blank, the new failure message identifies the stage; use Party source to change everyone together. Browser-enforced audible autoplay restrictions can still require a click inside the source.

---

# Web 0.2.6 — 12 October 2026

- Replaced the sun-like Settings glyph with a six-tooth cog and central circular hole.
- Renamed Watch Together to Together in navigation, pages, player labels, help text and accessibility labels.
- Production build succeeds. Existing playback and route behavior are unchanged.

# Validation — 12 October 2026 · Web 0.2.5 / Backend 0.2.3

- 23 web tests pass, including origin/frame/title/episode validation, real-position UI, initial activation without room Play, advancing playback plus pause acknowledgement, startup alignment, ignored play/pause commands, stale telemetry, disconnects and iframe reload isolation.
- The React integration test exercises TV-party joining, the local startup button, failure recovery, fresh iframe creation, rejection of old-window messages and a confirmed whole-party source change.
- 21 backend tests pass, including a real two-client WebSocket test, late join while playing, loss of readiness without a buffering event, explicit Pause cancelling automatic recovery, source change preservation and stale epoch rejection.
- Production Vite build uses the existing frontend repository variable. No new backend variables or APK are required.

## Live provider limitation

In the cloud browser, VidFast remained at “FETCHING, ONE MOMENT...” after one reload, and VidCore remained at “FETCHING YOUR CONTENT...”. Neither reached a playable video in this test. These observations do not establish an outage for other browsers or networks. Tests validate ANY's protocol and UI against controlled provider events, not third-party video decoding. Real TV-to-browser playback still requires a device check with a source that loads.

## Historical 0.2.5 device check

Refresh the website to version 0.2.5, join with a different profile from the TV, and start the web video once. If needed click Play inside the source. The startup check should return the video to the paused party position. Play on TV; confirm both real videos move, then check pause, seek and episode change. A blank or blocked browser player must keep the party waiting and expose Reload player / Party source.
