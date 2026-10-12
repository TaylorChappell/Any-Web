# ANY Web

A responsive ANY frontend for GitHub Pages, connected to the existing Railway
backend at `https://any-production-8ce3.up.railway.app`.

The `TaylorChappell/Any` repository stays backend-only. This frontend lives at
`TaylorChappell/Any-Web`; editable source is in `app/`, and the root contains the
compiled GitHub Pages site.

## GitHub Pages updates — no code-entry screen

The website automatically connects to the fixed backend and opens the profile picker.
The existing Pages branch deployment (`main`, root) is retained. The release
includes a compiled site so the current hosting setup receives this update directly.

For future source changes, set the repository Actions **variable** `ANY_API_TOKEN`
to the existing Railway ANY token under Settings → Secrets and variables → Actions
→ Variables. The included workflow tests `app/`, builds it with
`VITE_ANY_API_TOKEN: ${{ vars.ANY_API_TOKEN }}`, and deploys the compiled site through GitHub Pages. It runs when `app/` changes or when manually dispatched.
A missing variable fails the build without replacing the working site. The workflow runs from `main`, which is the configured Pages source branch.
You can also select GitHub Actions as the Pages source after the variable is set.

The frontend token is public in the compiled JavaScript. A repository variable
keeps it out of editable source, but cannot hide it from website visitors. The
TMDB key, release-admin token and signing keys must never be used here. Changing
the variable requires a new build.

## Local development

Use Node 24.15+ (latest Node 24 recommended), or Node 22.22.2+:

```bash
cd app
npm ci
cp .env.example .env.local
```

Set `VITE_ANY_API_TOKEN` in `.env.local` to the same Railway token. This file is
ignored by Git. Then run:

```bash
npm run dev
```

Open `http://localhost:5173`. That origin is already allowed by the backend.
The website connects automatically. Do not open `index.html` with `file://`.

```bash
npm test
npm run build
```

Tests use a fake token and do not need access to production. A production build
requires the configured token. Build output is in `dist/`; publishing it exposes
the frontend token as described above. Relative assets and hash routes work under
any Pages repository subdirectory, including refreshes on title/player screens.
There is no service worker caching old releases. Changes under `app/` rebuild the
root site using the same repository variable.

## Backend configuration

Browser support is deployed on the same Railway service. No changes are needed
for `https://taylorchappell.github.io` or `http://localhost:5173`.

If the frontend uses another GitHub account, a custom domain or a different
local port, set Railway `ANY_WEB_ORIGINS` to a comma-separated list of **origins**,
for example:

```text
https://taylorchappell.github.io,https://watch.example.com,http://localhost:5173
```

Do not include the repository path or a trailing slash. Do not use `*`.
The backend defaults for `ANY_WATCH_SOURCES` are `movish,vidfast,vidcore`.
If that variable was previously set to just `movish`, update it to include
`vidfast` for web parties. SQLite stays on the existing persistent volume; keep
one service replica. TMDB and release-admin credentials stay exclusively there.

## What is shared with the TV app

- The six-profile directory, names and 20 character avatar choices.
- My List, thumbs up/down, hidden Continue Watching entries and watch progress.
- Recommendation inputs, with title-based and genre-based suggestions.
- Watch Together invitations, member presence and the party timeline.

The TV must run the version that supports shared profiles to use these features;
older APKs with only local profiles cannot automatically see the new shared data.
Playback source preference and trailer sound are specific to each browser.
Profiles are shared household choices, not separately authenticated accounts.
Anyone able to load the website can use and manage those shared profiles.

At startup, the compiled frontend token registers a browser device over HTTPS.
The app retains the device's random token in local storage for subsequent calls;
the build token remains accessible in the public JavaScript bundle. A revoked or
expired device session is automatically replaced once. Network failures show a
retry option without asking the viewer for a token. Settings → Reset browser
connection revokes the current device, reconnects automatically and returns to
the profile picker. This is a connection reset, not an access-control sign-out.

Concurrent tabs cannot silently write to a different selected profile: the
backend checks the expected profile on each write. Only one live connection per
device is active. If a second tab takes over, use the displayed reconnect action
or select your profile again. Offline library changes retain their IDs for safe
retry and stay attached to the profile that made them.

## Playback and Watch Together

All eight source URL mappings are included. Normal playback defaults to Source 6
Movish, matching the TV app. Settings and the player offer the other seven.
The website loads provider embeds; the backend does not relay or extract films.
Provider uptime, supported browsers, content availability, ad behaviour and
regional restrictions are outside ANY's control. All eight sources are not a
guarantee that every title will play. ANY itself inserts no advertisements.

| Source | Browser integration |
| --- | --- |
| 1 VidCore | Documented play/pause/seek/status API; validated live messages required |
| 2 VixSrc | Embedded player; no integrated browser telemetry |
| 3 VidKing | Embedded player; no integrated browser telemetry |
| 4 VidFast | Documented play/pause/seek/status API; web party source |
| 5 VidRock | Validated progress events; use its own controls |
| 6 Movish | Validated progress events; use its own controls |
| 7 VidSrc | Embedded player; no integrated browser telemetry |
| 8 Peachify | Embedded player; no integrated browser telemetry |

A browser cannot inject the TV's WebView bridge into a cross-origin iframe.
Sources without a control API use their own controls. Sources without telemetry
cannot save reliable automatic playback positions; a manual Mark as watched
option is available. Movish can report progress, but cross-device exact resume
seeking requires a controllable source such as VidFast. The website does not
invent positions or mark playback ready merely because an iframe has loaded.
Switch to Source 4 for integrated resume, seeking and web party controls.

Web parties start with Source 4 VidFast and load paused. Invite any other shared
profiles from the friends button on a title. Invites appear in Watch Together.
Anyone joined can pause, play and seek; episode changes keep the same room.
Leaving the title leaves the room. Pending invitations are not shown as joined
members. Member avatars appear in the paused party controls.

New TV and web parties prefer Source 4 VidFast, with VidCore as a fallback when enabled.
Older Source 6 parties can be joined through an explicit confirmation to switch
everyone to a browser-controllable source. The shared timeline pauses at its current
position, the room and episode remain intact, and each member reloads the player.
Different video durations are rejected to avoid syncing different cuts.

Browser autoplay policies may require each person to click inside the video once.
If the provider never responds with real status, controls remain disabled and
the app explains how to reload or change sources. A paused or blocked player is
not treated as successfully synchronised. Do not interpret UI tests as proof that
a third-party video was decoded on a real device.

Escape hides visible ANY controls first, then leaves playback. Up/down show
controls; Space toggles playback and left/right skip 10 seconds while ANY has
keyboard focus and the source control connection is ready. When focus is inside
a third-party iframe, that provider handles keyboard input. Use the visible
controls to return focus to ANY. Browser Back leaves the current player.

Trailer keys come from the backend's TMDB videos endpoint. After three seconds
on a row preview, YouTube is asked to play it. The image stays visible until
YouTube reports real playback. Audible autoplay may be blocked; select Play
trailer to start with sound. Unavailable embeds offer a YouTube link. Search and
More Like This stay as portrait posters. Row expansion is an overlay and never
changes scroll layout widths. Reduced-motion preferences are respected.

## Validation

See `VALIDATION.md` for completed checks and limitations. The source download contains no real credentials, backend source files,
keystores or APKs. The deployed build will include the configured frontend token.

## External services and references

- Vite environment variables: https://vite.dev/guide/env-and-mode
- GitHub repository variables: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables
- ANY backend: https://any-production-8ce3.up.railway.app
- TMDB artwork: https://image.tmdb.org and metadata through the ANY backend
- YouTube IFrame API: https://developers.google.com/youtube/iframe_api_reference
- Provider API descriptions: https://vidfast.vc/ and https://vidcore.io/
- Google Fonts: DM Sans and Manrope, with system font fallbacks
- Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Pages workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Character artwork is retained from the existing ANY TV project. Source metadata
is in `public/avatars/sources.json`. Character and film rights remain with their
owners. This product uses the TMDB API but is not endorsed or certified by TMDB.
ANY is not affiliated with Netflix, YouTube or the playback providers.

## Collections and trailers — 0.2.3

The franchise shelf has 36 regular collections plus the MCU. Category rows load up
to 60 distinct titles. MCU entries include films, individual seasons, specials and
earlier connected Marvel series, sorted by release date, with category filters.
Season entries open the matching season. Future/undated entries stay hidden.
Franchise focus has a red frame, white outline and visible selection badge.

The trailer icon on title details opens a large YouTube player immediately. Hover
previews begin after three seconds. Browser autoplay restrictions may still require
a click before audio starts.
