# App Review Notes — Animal Adventures

Paste something like this into App Store Connect's "App Review Information → Notes" field.

```
Animal Adventures is a bilingual (English/Spanish) animal-learning app for young children, ages ~2-7.

No login or account is needed - all 10 games and all 24+ animals are unlocked and accessible immediately from the main menu. Nothing is gated behind payment, progress, or a timer (aside from the optional parent-set daily play limit described below).

PARENTAL GATE: tap the parent/lock icon on the main menu to reach "For Parents." This is protected by a gate that reads three digits aloud as number-words (e.g., "three · six · one") which must be entered on a numeric keypad - deliberately a reading task, not arithmetic, so it can't be passed by a pre-reading child but is trivial for an adult.

PRICING: this is a one-time paid download. There are no in-app purchases, no subscriptions, and no ads anywhere in the app.

NETWORK ACTIVITY: the only network call the app makes is an automatic check to Expo's update servers (u.expo.dev) on launch, to see if a JS bug-fix update is available (standard Expo/React Native OTA update mechanism). No reviewer action is needed to see or avoid this - it happens silently and does not affect app functionality if offline.

LANGUAGE: every screen has an English/Spanish toggle, usually a button in the top corner. All UI text, animal names, and audio exist in both languages.

No user-generated content, no chat, no social features, no external links reachable by a child (the only external link in the app, a parent donation link, is Android-only and does not exist in this iOS build; it's also behind the same parental gate described above).
```
