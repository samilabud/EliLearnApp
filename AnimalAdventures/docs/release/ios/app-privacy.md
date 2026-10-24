# App Privacy Questionnaire Answers — Animal Adventures

## Recommended answer: "Data Not Collected"

This is supported by three independent pieces of evidence from the actual code and build, not just the marketing copy:

1. **No third-party analytics, ads, or tracking SDKs** anywhere in `package.json`'s dependency tree (verified in `docs/release/ios-readiness.md` section a).
2. **The in-app analytics module (`utils/analytics.js`) never transmits anything.** It buffers events to on-device storage only; its `setSink()` function (the only way to wire a remote destination) is defined but never called anywhere in the codebase — verified by grepping the whole repo.
3. **The generated `PrivacyInfo.xcprivacy` manifest has an empty `NSPrivacyCollectedDataTypes` array** (`NSPrivacyTracking: false` too). This file is auto-assembled by Xcode from every installed native module's own Apple-mandated privacy manifest — including `expo-updates`. If any dependency declared collecting data, it would show up here. None do.

## One nuance worth knowing about (not a reason to change the answer, but worth understanding)

`expo-updates` contacts `https://u.expo.dev` on launch to check for OTA JS updates, sending app version, platform, and an Expo-generated installation identifier (disclosed in `PRIVACY.md`). This is operational/infrastructure traffic to make the update-check feature work, not something the app itself collects, stores, or links to a user — and per point 3 above, Expo's own privacy manifest doesn't declare it as a collected data type either.

I'm confident enough in "Data Not Collected" to recommend it, but this is ultimately Apple's categorization to apply, not something I can guarantee with certainty — if you want a second opinion, Apple's own "App Privacy Details" documentation in App Store Connect has guidance notes next to each question, and Expo may have published their own guidance for `expo-updates` specifically that's worth a quick check before you submit.

## Walking through App Store Connect's specific questions

When you get to the App Privacy section, for **every data category** (Contact Info, Health & Fitness, Financial Info, Location, Sensitive Info, Contacts, User Content, Browsing History, Search History, Identifiers, Purchases, Usage Data, Diagnostics, Other Data), answer **"Data is not collected."**

If App Store Connect's flow specifically prompts about analytics or crash data (some versions ask this separately even when you answer "not collected" above): there is no crash reporter (no Sentry/Crashlytics/Bugsnag in dependencies) and no analytics transmission, so the honest answer there is also "not collected."
