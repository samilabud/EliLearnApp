# iOS Release Readiness — Animal Adventures

Read-only audit. Nothing in the repo was changed to produce this. Written 2026-10-23.

## a) Kids Category and children's privacy (guidelines 1.3, 5.1.4)

**Dependencies (`package.json`):** every dependency is an Expo/React Native core
module or a UI library (Lottie, Reanimated, SVG, confetti, safe-area-context,
async-storage, vector-icons, Google Fonts). There is no analytics SDK, ad SDK,
crash reporter, or third-party tracking library in the dependency list.

**In-app analytics (`utils/analytics.js`):** real, but local-only. It buffers
events (`app_open`, `mode_selected`, `game_started`, etc.) into AsyncStorage
and exposes `setSink(fn)` so a remote destination *could* be wired in later.
I grepped the whole repo for calls to `setSink` — there are none. Nothing is
transmitted today. The only identifier is a `Math.random()`-based `installId`
that never leaves the device.

**Network calls, all of them:**
1. `expo-updates` checks `https://u.expo.dev/3b6c1a9f-...` on launch, to see
   if an OTA JS update is available (`app.json` → `updates.url`). This sends
   app version, platform, and an Expo-generated install ID. This is disclosed
   in `PRIVACY.md` already. It's the app's own update mechanism, not a
   third-party tracker — should be fine under 5.1.4, but see open question
   below about whether Apple wants it called out in App Privacy answers too.
2. PayPal donate link (`components/parents/parent-area.component.jsx:43,89`,
   `Linking.openURL('https://paypal.me/samilabud')`) — **Android only**
   (`Platform.OS === 'android'` guard at line 250), so it doesn't exist in
   the iOS bundle at all. No action needed for iOS.

No other `fetch`, `http(s)://`, `WebView`, or `Linking` calls exist anywhere
in `App.jsx`, `contexts/`, `utils/`, or `components/`.

**Parental gate:** real and correctly wired. `ParentalGate`
(`components/parents/parental-gate.component.jsx`) shows a 3-digit code
spelled out in words (a reading task, not arithmetic — a non-reader can't
pass it) before `ParentArea` opens. In `App.jsx`, `ParentArea` is only
reachable after `ParentalGate.onPass()` fires (lines 256–270). There's no
path to the parent screen, or anything in it, without passing the gate first.

**Verdict:** I found no third-party analytics, no ads, no tracking, and no
child-reachable external link. This matches what `PRIVACY.md` already claims.

## b) Privacy policy text and URL

`PRIVACY.md` (repo root, last updated 18 Sep 2026) is accurate against the
code I read: no personal data collected, local-only storage, the one
network call (Expo Updates) disclosed by name, no ads, no purchases
mentioned for the free/no-IAP case, no outbound links on iOS.

**What's missing:** App Store Connect requires a *public URL*, not a file in
the repo. I could not find any hosting for `PRIVACY.md` in the repo (no
GitHub Pages config, no Netlify/Vercel file, nothing in
`docs/store-listing/`). **Question for you:** is `PRIVACY.md` published
anywhere right now (e.g. a GitHub raw link used for the Play Store listing)?
If yes, give me that URL and I'll reuse it. If no, the simplest option is a
GitHub raw URL (`https://raw.githubusercontent.com/.../PRIVACY.md`) or
GitHub Pages — I'd want your go-ahead before setting either up since it's a
public-facing change outside the repo.

## c) iPad support

`supportsTablet: true` is set, so Apple will require iPad screenshots and
will review the app running on iPad.

What I checked: which game screens use a responsive-sizing approach.
- `find-animal`, `guess-animal`, `memory-animal`, `trace-letter`,
  `whose-sound`, `first-letter`, `main-menu`, `album`, `animal.screen` all
  use `Dimensions.get` or `useWindowDimensions`.
- `build-scene`, `coloring`, `counting` don't use those hooks, but they
  measure their own container via `onLayout` into local state
  (`sceneSize`/`canvasSize`), which is also a responsive pattern — just not
  via the `Dimensions` API. I did not find hardcoded full-screen pixel
  widths in any of the three.

This is a code-level scan, not a visual one — it tells you the screens are
*built* to be responsive, not that they *look right* on an iPad or in
landscape. I have not run the app on an iPad simulator. **I can't verify
visual correctness without actually running it** (see Step 2 — I'd suggest
launching on an iPad simulator before you submit screenshots).

Given `orientation: "default"` (all four orientations allowed, confirmed in
the generated `Info.plist` — portrait, upside-down, landscape-left,
landscape-right, both phone and `~ipad` keys list all four), the real risk
is landscape on iPad specifically, since that's the combination least
likely to have been manually tested. I'd recommend testing landscape iPad
before submitting rather than disabling tablet support — turning
`supportsTablet` off would also mean losing the larger-screen audience and
would require new screenshots anyway.

## d) Native folder consistency — ios/ vs app.json

**`ios/` and `android/` are git-ignored** (`.gitignore` has `/ios` and
`/android`), and `git log` confirms zero commits ever touched files under
`ios/`. This is a **CNG (Continuous Native Generation) / Expo prebuild**
project: the native folders on your disk right now are a local build
artifact from whenever you last ran `expo prebuild` or `expo run:ios`, not
checked-in source.

**Proof it's stale:** the `ios/` folder on disk right now says
`CFBundleShortVersionString = 5.3.2` (Info.plist) and
`MARKETING_VERSION = 1.0` (Xcode project) — both stale. `app.json` says
`5.5.0`. This mismatch is expected and harmless *because the folder gets
regenerated*, but see the EAS caveat below.

**Direct answer to your question — does `app.json` or `ios/` control the
build:**
- **`eas build`** (cloud): runs `expo prebuild` fresh from `app.json` every
  time, so `app.json` plugins and `ios.*` settings are what ships. The
  stale local `ios/` folder is irrelevant to EAS cloud builds.
- **Local `expo run:ios` or opening the `.xcworkspace` directly**: uses
  whatever is on disk in `ios/` right now, which is stale (5.3.2 / 1.0)
  until you run `npx expo prebuild --clean` again (there's already an
  `npm run prebuild` script that does this). If you build locally without
  re-running prebuild first, you'll ship old version numbers.

**Practical rule: always run `npm run prebuild` (or let `eas build` do it
for you) before any build you intend to upload — never trust what's
sitting in `ios/` on disk.**

## e) Version and build number rules

Apple requires `CFBundleVersion` (the build number) to strictly increase on
*every* upload to App Store Connect, even for re-uploads of the same
marketing version (e.g. a second TestFlight build after a crash in the
first). Apple parses it as a dot-separated sequence of integers.

**Current setup (`eas.json` `cli.appVersionSource: "local"`):** EAS reads
the version to embed from `app.json` (since there's no committed native
project for it to read from instead) — it does not auto-increment anything
for you.

**The problem:** `scripts/bump-version.js` sets `ios.buildNumber` to the
*same string* as the marketing version (e.g. both become `"5.5.0"`). That's
fine for the *first* upload of 5.5.0, but if you ever need a second upload
of the same marketing version (a TestFlight fix before public release,
or an App Review rejection fix), the build number won't have changed and
Apple will reject the upload.

**Proposed fix (smallest safe change, for your approval in Step 2):**
give iOS its own build-number counter, separate from the marketing version
string, e.g. add an `ios.buildNumber` field to the bump script that just
increments an integer (like `android.versionCode` already does) instead of
mirroring the semver. Alternative: set `cli.appVersionSource` isn't needed —
EAS also supports `eas build --auto-submit` style remote version management,
but since you're already using `"local"` successfully for Android, keeping
`"local"` and just fixing the bump script to track iOS build number
independently is the smaller change.

**Current `app.json` value:** `ios.buildNumber: "5.5.0"` — valid for a first
upload, but I'd fix the bump script before your *second* iOS upload, not
necessarily before the first.

## f) Missing assets

- **App icon:** `assets/icon.png` is 1024×1024, no alpha channel (checked
  with `sips`) — already meets the App Store's icon requirement.
- **Splash:** no dedicated splash image file; `expo-splash-screen` plugin
  generates one from `icon.png` at 200px wide on a `#BD0000` background.
  This is fine for App Store review (Apple doesn't review splash screens
  separately), but worth a visual check since showing an icon that small
  on an iPad might look sparse — your call, not a blocker.
- **Screenshots:** none found in `docs/` for App Store sizes.
  `docs/screenshots/` has 19 PNGs but I didn't check their exact pixel
  dimensions — they look like they were taken for the Play Store listing.
  App Store screenshots need specific iPhone (6.7" / 6.5" or similar,
  depending on current Apple requirements) and iPad sizes; existing
  Play Store screenshots will very likely be the wrong aspect ratio/size
  and will need to be retaken on an iOS simulator or device. I'll cover the
  exact required sizes in the Step 4 checklist.
- **`PrivacyInfo.xcprivacy`:** already present in the generated `ios/`
  folder and looks reasonable (declares `UserDefaults`, `FileTimestamp`,
  `SystemBootTime` required-reason API usage, `NSPrivacyTracking: false`,
  empty `NSPrivacyCollectedDataTypes`). Since `ios/` is regenerated by
  prebuild, this file is auto-assembled from your installed Expo modules'
  own manifests each time — nothing to hand-edit, but worth re-checking
  after the next `prebuild` in case a dependency bump changes what APIs
  get flagged.

## g) Anything Android-only

- The PayPal donate button in the parent area (section a, above) —
  `Platform.OS === 'android'` gated, doesn't exist in the iOS bundle.
- `promiseNoPurchases` is dropped from the "what this app doesn't do" list
  on iOS (`parent-area.component.jsx:35`) — **the code comment says this is
  because "the iOS build is a paid download instead."** This directly
  contradicts what you told me (the app is free). **Open question — this is
  important:** is Animal Adventures meant to be a paid download on iOS, or
  free like Android? If it should be free, this line (and the missing
  "no purchases" promise) needs to change before submission, since right
  now the code assumes iOS charges money and is quietly not telling parents
  "no purchases" on a platform where, per you, there are also no purchases.
- `android.blockedPermissions` in `app.json` (SYSTEM_ALERT_WINDOW, VIBRATE,
  READ/WRITE_EXTERNAL_STORAGE) has no iOS equivalent needed — these are
  Android manifest permissions being explicitly stripped, not a feature gap.
- Nothing else Android-specific found in game logic, haptics, or sound
  code — `expo-haptics` and `expo-audio` are cross-platform.

## Open questions for you

1. Where (if anywhere) is `PRIVACY.md` currently published as a public URL?
   Needed for App Store Connect's privacy policy field.
2. **Is the iOS app supposed to be free or paid?** The parent-area code
   currently assumes "paid download" on iOS; you told me "free." This needs
   resolving before Step 2's plan, since it affects App Store Connect
   pricing setup and the in-app copy.
3. Do you want iPad landscape actually tested on a simulator before
   screenshots are taken, or do you want to ship the responsive-code
   evidence above and fix anything that looks wrong after a simulator pass
   (which I'd still recommend doing before final screenshots either way)?
4. Any existing Apple Developer Portal state I should know about (App ID
   already registered, any existing provisioning profiles) before I propose
   build/submit steps?
