# Screenshot Checklist — Animal Adventures

I can't guarantee the exact current pixel dimensions App Store Connect requires (Apple changes these periodically) — the upload screen itself will tell you authoritatively what it accepts. What's stable is which **device classes** you need to shoot from. Capture from the largest simulator in each class; Apple generates/accepts the smaller sizes from those (or tells you at upload time if a separate smaller set is still required).

## Devices to capture from

- [ ] **iPhone, 6.9" class** — simulator: iPhone 17 Pro Max (or iPhone 16 Pro Max)

**iPad screenshots are no longer needed.** `supportsTablet` was switched to `false` on 2026-10-24 after discovering that at least 2 of the 6 quiz-style game screens (`whose-sound`, `first-letter`, and likely `find-animal`, `guess-animal`, `memory-animal`, `trace-letter` too, since they share the same layout pattern) leave roughly 60-70% of an iPad screen empty below the content — confirmed by actually running the build on an iPad simulator, not just inferred from code. Menu, Album, and Build a Scene all looked correct on iPad, so this is a fixable layout bug in those specific screens, not a fundamental incompatibility — iPad support should come back in a follow-up version once that's fixed, at which point this checklist's iPad row should be restored.

## What to capture (suggest 5-6 per device class, portrait)

1. [ ] Main menu — shows the game variety and the friendly visual style
2. [ ] A gameplay screen mid-game (e.g., Guess the Animal or Whose Sound Is It?) — shows actual play, not just menus
3. [ ] Animal Album screen — shows the collection/progression hook
4. [ ] Build a Scene or Coloring Book — shows the free-play, no-wrong-answer mode
5. [ ] Today's Animal highlight or the star/reward moment — shows positive feedback
6. [ ] "For Parents" area (the promises list: no ads, no accounts, etc.) — this screen alone does a lot of trust-building work for a parent scrolling the listing

Landscape isn't required by Apple, but since the app supports all four orientations (`orientation: "default"`), you could optionally add one landscape iPad shot if it looks good — not mandatory.

## Before shooting

Run through `docs/release/ios-readiness.md` section c first (the iPad layout check) — no point taking final screenshots of a screen that still needs a layout fix.
