# ANY Desktop 0.3.3

Windows x64 app, installed per user by `ANY-Setup-0.3.3.exe`. It creates desktop
and Start menu shortcuts and does not require a separate browser or WebView2
installation. The installer includes Electron/Chromium. Internet is required.

The interface loads the owned HTTPS site at https://anymovies.fun. Profiles,
progress and Together use the existing Railway backend. No access-code or
backend setup screen is shown. Desktop stores its own device session; use a
different profile from the TV when watching together. Interface updates arrive
from the website; native shell updates are checked on launch and every six hours. Settings and the ANY menu have Check for updates, Download update, and Restart and install. Restart requires confirmation and updates never install automatically on quit. Install 0.3.1 once over 0.3.0 to enable this.

## Native playback

The source runs as a top-level WebContentsView, separately from the interface.
A narrow isolated-world bridge controls its actual HTML video element. Movish,
VidFast and VidCore are enabled for Together when the backend enables them.
Desktop-created parties always start with Movish. Existing TV parties retain their source.
Play, pause, seeking and episode changes use the existing party protocol; a new
episode closes the old view, invalidates its session and verifies readiness anew.

The app proves advancing playback and acknowledged pause before marking a player
ready. Keyboard shortcuts: Space/Enter play-pause, arrows left/right skip 10s,
Escape closes the episode chooser or leaves playback, F11 fullscreen. ANY's
controls automatically hide after three idle seconds during active playback. The title bar and controls then give their entire area to the video, in windowed and fullscreen modes. Mouse movement or Up/Down restores controls; pausing, loading, errors and dialogs keep them visible. Source player containers and same-origin frame wrappers are resized around the existing video with object-fit: contain, preserving aspect ratio, subtitles and playback state. Native bounds follow window resize/fullscreen events without waiting for a renderer measurement. Modal dialogs hide
the native view until closed, without changing the party or episode.

Source pages have no Node integration, no preload or desktop IPC, no downloads,
no popups and no camera/microphone permissions. Chromium sandbox, HTTPS checks,
context isolation and web security remain enabled. Navigation is restricted to
approved source origins and the selected title/episode. No arbitrary URLs or
JavaScript are accepted through the interface bridge. Only same-origin nested
video documents are inspected; no cross-origin iframe restriction is disabled.
The native view shuts down when the interface closes, crashes or stops sending
its heartbeat.

Third-party availability, DRM, nested cross-origin-only players and regional
restrictions can still prevent playback. This app does not resolve, decrypt or
proxy media streams. No third-party source is described as verified from tests
using the included locally generated test clip.

## Build and validation

`npm ci`, `npm test`, `npm run test:electron`, then `npm run dist:win` on Windows.
The GitHub Actions Windows build tests two real native video players, builds the
NSIS installer, silently installs it in a temporary directory, and repeats those
tests using the installed executable. It uploads the installer, SHA256 and test
report. After validation, CI publishes the installer, blockmap and latest.yml in an immutable-version GitHub release. The packaged feed uses that public repository without credentials. Installed updater tests detect a newer version, download the real NSIS installer, verify SHA512, reject a corrupted checksum, and detect the current version. Windows signing is not configured, so checksum/HTTPS integrity does not provide Authenticode publisher identity.

The test clip is generated locally and has no third-party content.
`lib/party-sync.mjs` is copied from `app/src/playback.js` by CI before testing.

This initial installer has no Authenticode signing certificate. Windows may
identify the publisher as unknown. Android signing keys are not used for Windows.
