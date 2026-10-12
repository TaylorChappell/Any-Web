# Validation — 12 October 2026 · Web 0.2.5 / Backend 0.2.3

- 23 web tests pass, including origin/frame/title/episode validation, real-position UI, initial activation without room Play, advancing playback plus pause acknowledgement, startup alignment, ignored play/pause commands, stale telemetry, disconnects and iframe reload isolation.
- The React integration test exercises TV-party joining, the local startup button, failure recovery, fresh iframe creation, rejection of old-window messages and a confirmed whole-party source change.
- 21 backend tests pass, including a real two-client WebSocket test, late join while playing, loss of readiness without a buffering event, explicit Pause cancelling automatic recovery, source change preservation and stale epoch rejection.
- Production Vite build uses the existing frontend repository variable. No new backend variables or APK are required.

## Live provider limitation

In the cloud browser, VidFast remained at “FETCHING, ONE MOMENT...” after one reload, and VidCore remained at “FETCHING YOUR CONTENT...”. Neither reached a playable video in this test. These observations do not establish an outage for other browsers or networks. Tests validate ANY's protocol and UI against controlled provider events, not third-party video decoding. Real TV-to-browser playback still requires a device check with a source that loads.

## Device check

Refresh the website to version 0.2.5, join with a different profile from the TV, and start the web video once. If needed click Play inside the source. The startup check should return the video to the paused party position. Play on TV; confirm both real videos move, then check pause, seek and episode change. A blank or blocked browser player must keep the party waiting and expose Reload player / Party source.
