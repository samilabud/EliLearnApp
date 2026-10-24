# Manual Steps Checklist — App Store Connect & Apple Developer Portal

Things only you can do (account-holder actions, payment/legal agreements, or UI I can't drive). Roughly in order.

## Apple Developer Portal (developer.apple.com)

- [ ] Confirm membership is active (already done — see memory)
- [ ] Register the App ID: Certificates, Identifiers & Profiles → Identifiers → + → App IDs → bundle ID `com.elilearnapps.animaladventures`. This is separate from the Android Play package name even though the string matches — Apple doesn't know about your Android registration.

## App Store Connect (appstoreconnect.apple.com)

- [ ] **Agreements, Tax, and Banking**: since this ships as a paid app, sign the Paid Applications Agreement and add bank/tax info. Apple won't let you set a price without this.
- [ ] **Create the app record**: My Apps → + → New App → select the bundle ID you registered, set primary language, SKU (any internal identifier, e.g. `animaladventures-ios`).
- [ ] **Set pricing**: pick a price tier for the paid download.
- [ ] **Category**: choose **Kids** as the primary category, then select the age band(s) per `docs/release/ios/kids-category.md`. (Apple may also ask for a secondary category — Education is a reasonable pairing.)
- [ ] **Age Rating questionnaire**: answer honestly — no violence, no mature content, no user-generated content, no gambling, etc. Should land at the lowest rating tier given the content.
- [ ] **Privacy Policy URL**: enter the public URL once it's hosting the corrected content (see the separate prompt I gave you for the elilearnapps.com repo) — not the repo's `PRIVACY.md` file directly, Apple needs a live webpage.
- [ ] **App Privacy questionnaire**: use `docs/release/ios/app-privacy.md`.
- [ ] **Kids Category compliance attestations**: App Store Connect shows extra required toggles/questions specifically for Kids Category apps (e.g., confirming no third-party analytics, no behavioral ads) — answer truthfully per the same evidence in `docs/release/ios-readiness.md`.
- [ ] **Store listing text**: name, subtitle, description, keywords, "what's new" — all in `docs/release/ios/store-listing.md`, for both English and Spanish localizations.
- [ ] **Support URL**: needs a live page too (could be the same site as the privacy policy, e.g. an `elilearnapps.com` support/contact page — check if one already exists).
- [ ] **App Review contact info + notes**: use `docs/release/ios/app-review-notes.md`.
- [ ] **Upload app icon**: already have a valid 1024×1024, no-alpha PNG (`assets/icon.png`) — App Store Connect will ask you to upload it directly in the listing (separate from the one bundled in the build).
- [ ] **Upload screenshots**: per `docs/release/ios/screenshot-checklist.md`.

## Build & TestFlight

- [ ] Once the app record exists, its App Store Connect app ID (`ascAppId`) becomes available — tell me this and I'll fill in `eas.json`'s `submit.production.ios` block (left empty on purpose, see `ios-readiness.md` section e).
- [ ] Run `eas build --platform ios --profile production` (I'll give you the exact command with cost info separately, per the original plan's Step 5 — not run yet).
- [ ] Run `eas submit --platform ios` once the build finishes, to upload it to TestFlight.
- [ ] Add yourself (and anyone else) as an internal TestFlight tester, install via the TestFlight app, and actually play through it on a real device before submitting for review.
- [ ] When satisfied, attach the build to a new App Store version in App Store Connect and hit **Submit for Review**.

## After submission

- [ ] Watch App Store Connect's Resolution Center in case a reviewer has a question — Kids Category apps sometimes get extra scrutiny on the parental gate and privacy claims, which this app is well-positioned to answer given everything verified in `ios-readiness.md`.
