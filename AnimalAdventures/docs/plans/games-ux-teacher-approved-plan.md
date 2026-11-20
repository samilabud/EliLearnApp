# Games UX + Teacher Approved fix plan

Written 2026-11-19 for an implementing agent (Claude Sonnet). Work through the
phases **in order**. Each phase is its own branch and PR into `main`. Do not
start a phase until the previous one is merged or the user says to skip it.

## Status (2026-11-19)

| Phase | Code | Branch | Still open |
| --- | --- | --- | --- |
| 1 Text fit | Done | `fix/text-fit-component` | Device screenshots, iPad check |
| 2 Interaction | Done (2.1-2.7) | `feat/interaction-design` (stacked) | Device check; Coloring hit areas not re-audited |
| 3 Words/sounds | Plumbing, loudness script and 9 clip fixes done | same | You: record clips (`feedback-voice-script.md`), approve copy (`copy-proposals.md`) |
| 4 Engagement | Band to Album; first stars for Band/Build/Coloring | same | Learn already uses `GameScreen` (the plan was wrong); age bands already differ |
| 5 Review gate | Not started | - | Yours: videos, store screenshots, release, request on/after 2027-01-22 |

Known mismatch: the recorded spoken instruction for Build a Scene still says
"drag"; the on-screen text now says "tap or drag". Re-record when convenient.

## Context you need first

- App: Animal Adventures, Expo 57 / React Native 0.86, child-directed (ages
  2-8), English + Spanish. All app code is in `AnimalAdventures/`.
- Google Play **Teacher Approved** rejected it twice. The last feedback (Oct
  2026) was under "Design, appeal, and enrichment", with two named problems:
  1. **Words or sounds**: amount of text for the age, voiceover quality,
     vocabulary/tone.
  2. **Interaction design**: button size or placement, ease of navigation for
     the age.
  Both age bands are judged: 5-and-under and 6-8. Next review can be requested
  **Jan 22, 2027**. Everything here must ship and soak in production before
  then.
- Standing rules this project already follows (do not regress them):
  - Adjacent tappable controls: `gap: 16` minimum.
  - Touch targets: `MIN_TOUCH_TARGET` (48) / `LARGE_TOUCH_TARGET` (60) /
    `useResponsive().touchTarget`. Never ad-hoc sizes.
  - Icon-only buttons need a visible text label too.
  - Never make fine motor skill the only way to succeed.
  - New audio: about -16 LUFS. Check with
    `ffmpeg -i <file> -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=summary -f null /dev/null`.
  - Warm, short, positive copy. Nothing scary, sad or flat-sounding.
  - Menu icons are tiny hand-authored vector Lottie (2-5 KB), same style as
    the existing ones.
- Shared building blocks (reuse, don't duplicate):
  `components/utility/game-screen.component.jsx` (header + play area),
  `bouncy-button`, `answer-card`, `fit-grid`, `instruction-text`,
  `feedback-overlays` (`CorrectBurst`, `TryAgainBanner`, `CompletionOverlay`),
  `utils/use-instruction-prompt.js`, `utils/use-responsive.js`,
  `constants/theme.js` (`titleText`, `PALETTE`, `FONTS`),
  `constants/layout.js`, `constants/strings.js` (`t(lang, key)`).
- Tooling:
  - `npm run lint` must pass (warnings OK, no new errors).
  - **Do not run `npm run format`**: it rewrites the whole repo, including
    huge Lottie JSONs. Use `npx prettier --write <changed files>` and check
    `git status --short` before committing.
  - No test framework exists. Verification is lint plus running the app.
- Device testing: local release build, not dev client (Metro is too slow):
  `eas build --profile preview --platform android --local --non-interactive --output /tmp/animaladventures-preview.apk`,
  then `adb install -r` on a freshly wiped emulator
  (`emulator -avd Pixel_7_Pro_API_33_2_6GB -wipe-data`). The user also tests
  on a real phone and an iPad. Screenshots for every phase go in the PR.
- Git push: the `origin` SSH alias authenticates as the wrong GitHub account.
  Push with
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/samilabud/EliLearnApp.git <branch>`.
  Repo allows squash merges only.

---

## Phase 1: Fix text wrapping / truncation for good (highest priority)

### Symptom

Titles and labels that need to wrap show only their first one or two words.
The rest disappears with no ellipsis. It is worst in Spanish, on narrow
phones, and on Android.

### Why it keeps coming back

It has been patched at least four times (PRs #18, #20, #22, #31), each time
locally. Current state:

- **13 call sites** use `numberOfLines={1|2}` + `adjustsFontSizeToFit` +
  `minimumFontScale`. On Android, `adjustsFontSizeToFit` is unreliable with a
  custom font (Bangers) combined with `lineHeight`. When it fails to shrink,
  `numberOfLines` truncates. Run
  `grep -rn "numberOfLines" components` for the list.
- `components/world_menu/world-page.component.jsx:326`: the map's location
  labels are capped at `numberOfLines={2}` inside a pill that can't be wider
  than the disc above it (`maxWidth: '100%'` of a ~110-150 pt landmark).
  "¿De Quién es Este Sonido?" or "Adivina la Primera Letra" at 18 pt Bangers
  cannot fit, so you see "¿DE QUIÉN ES" and nothing else. This is the clearest
  reproduction.
- `bouncy-button.component.jsx` documents "Android can clip/truncate a child
  Text (showing only its first word)" and works around it with
  `renderToHardwareTextureAndroid`. That masks one trigger (the scale
  transform) but not the others below.
- The theme says to see "the long-form note in trace-letter.game.component.jsx"
  for the Bangers clipping fix. **That note no longer exists.** The fix
  (`includeFontPadding: false`, explicit `lineHeight`,
  `textBreakStrategy="simple"`) is applied in some places and not others.
- Text children of a view that has both `borderRadius` and `backgroundColor`
  get clipped on Android (already documented in `answer-card.component.jsx`).
  The world label pill (`labelPill`) is exactly that pattern.
- Some text sits in row layouts without `flexShrink: 1` / `minWidth: 0`. Yoga
  measures it on one line, then the row squeezes it, so it wraps into a box
  that is still one line tall and lines 2+ are cut off.

### Fix: one component, one rule, one guard

1. **Create `components/utility/fit-text.component.jsx`**, the only way to
   render a child-facing title or label that might not fit. Contract:
   - Props: `children` (string), `style`, `maxLines` (default 2),
     `minScale` (default 0.75), `font` (`'title' | 'body'`, default
     `'title'`), plus pass-through accessibility props.
   - Always applies the Android-safe base: `includeFontPadding: false`,
     explicit `lineHeight = round(fontSize * 1.25)` (1.3 for Bangers),
     `textBreakStrategy="simple"`, `flexShrink: 1`, plus a 2-4 pt
     horizontal padding (Bangers slants past its last glyph).
   - **Shrinks in JS, not with `adjustsFontSizeToFit`.** Use `onTextLayout`.
     If `lines.length > maxLines`, or any line's width is wider than the
     measured container (a single long word), step `fontSize` down by
     about 8% and re-measure until it fits or reaches `minScale`. Hide the
     text with `opacity: 0` until it has settled (usually one or two passes)
     so there's no visible flicker. Recompute when `children`, base size or
     container width change.
   - **Never truncates.** It never sets `numberOfLines`. If the text still
     doesn't fit at `minScale`, it shows extra lines and the container
     grows. Overflow should look slightly tall, never cut off.
   - Caps OS font scaling with `maxFontSizeMultiplier={1.3}`, so huge system
     font sizes can't blow up layouts but still get some scaling.
   - Container rule: its parent must not have a fixed `height`. Use
     `minHeight`. Document this in the component's JSDoc.
2. **Replace every `numberOfLines` / `adjustsFontSizeToFit` call site** in
   child-facing UI with `FitText`. Parent-area screens (adult text) may keep
   plain `Text` but must also drop `numberOfLines` unless truncation is
   really wanted there.
3. **Fix the containers** found while replacing:
   - World map label: remove `numberOfLines={2}`. Let the label pill be wider
     than the disc (e.g. `maxWidth: size * 1.6`, centered, `alignSelf:
     'center'`). Move its white rounded fill to an absolutely positioned
     sibling, as `AnswerCard` does. Check that labels on neighbouring
     landmarks don't overlap on a 360-pt-wide phone. If they do, adjust the
     landmark positions in `constants/worlds.js`, not the font.
   - Search for text inside `View`s with `borderRadius` + `backgroundColor`
     (pills, chips, badges, `heroCard`, `titlePill`, completion card,
     `TryAgainBanner`) and apply the same sibling-fill pattern wherever the
     text can wrap.
   - Any `Text` that is a direct child of a `flexDirection: 'row'` view next
     to an icon gets `flexShrink: 1` (FitText does this already).
4. **Fix the stale doc.** Move the Bangers-on-Android explanation into the
   `titleText` JSDoc in `constants/theme.js` (what happens, which three
   props fix it, the rounded-fill parent issue). Point every
   "see trace-letter" comment there instead.
5. **Guard so it can't come back:**
   - ESLint: in `eslint.config.js` add a `no-restricted-syntax` rule
     (error) on `JSXAttribute[name.name='numberOfLines']` and
     `JSXAttribute[name.name='adjustsFontSizeToFit']`, with a message
     pointing to `FitText`. Turn it off for `fit-text.component.jsx` and
     `components/parents/**` only.
   - Dev-only text stress screen: `components/parents/text-stress.screen.jsx`,
     reachable from the parent area only when `__DEV__` (or behind a hidden
     long-press for release builds used in testing). It renders every
     world-map label, menu tile title, game header (level chip + instruction),
     completion card and Album title, in **both** languages. Add a toggle that
     appends " Extra Largo" to every string to simulate future, longer
     copy. Use this screen for the before/after screenshots.

### Acceptance

- `grep -rn "numberOfLines\|adjustsFontSizeToFit" components` returns
  only `fit-text.component.jsx` and `components/parents/**`.
- `npm run lint` passes, and the new rule fails if you add a `numberOfLines`
  to a game file (try it, then revert).
- On a 360-pt-wide Android phone, Spanish, system font size at **largest**:
  every title on all 4 world pages, every game header, every completion card
  and the Album show every word. Same check in English, landscape, and on an
  iPad. Screenshots in the PR.

---

## Phase 2: Interaction design (Teacher Approved category 2)

1. **Label the icon-only header buttons.** Reset (`confirm-reset-button`)
   and Next Game (`next-game-button`) are icon-only, which breaks the
   project's own rule. Give each a short label under the icon ("Again" /
   "Otra vez", "Next" / "Siguiente") rendered with `FitText` (body font,
   about 13-14 pt, which is fine for a label paired with an icon). Keep the
   48-pt minimum and the 16-pt gaps. On a phone in portrait, check that Home
   + Reset + Next + Language still fit in one row at 360 pt. If not, move
   Language into the second header row next to the level chip. Never shrink
   gaps below 16.
2. **Reset confirmation must be visible, not just announced.** Today the
   first tap only turns the button gold and changes its a11y label. While
   `confirming`, show a visible "Tap again" / "Toca otra vez" label and a
   gentle pulse (respecting reduce motion).
3. **Respect reduce motion everywhere.** Only the world map reads it today.
   Add a `useReduceMotion()` hook in `utils/` (wrap
   `AccessibilityInfo.isReduceMotionEnabled` and its change event) and use
   it in `CompletionOverlay` (pulse loop), `CorrectBurst` (confetti),
   `Wiggle`, `AmbientBackground`, `ZoomTransition`, and the idle animations
   on the world map. With reduce motion on: no loops, short fades instead of
   bounces, confetti replaced by a static star.
4. **Minimum readable size on child-facing screens.** These are below
   `MIN_FONT_SIZE` (18) and not clearly paired with an icon: `album.screen`
   (13 pt at L387, L412, 14 at L466), `world-page` star badge (14), main menu
   hero label (15) and L892/L928. Raise them to at least 16 when paired with
   an icon, otherwise 18. Parent area and parental gate are exempt.
5. **Hints everywhere there's a right answer.** Memory has none. After 3
   mismatches in a row, briefly flash (about 1 s) one unmatched pair, using
   the same gold `hinted` treatment as `AnswerCard`. Check Counting, Trace,
   Missing and First/Last Letter use the same "hint after N tries" threshold
   (centralise N in `constants/difficulty.js` if it differs per game).
6. **Drag never the only way.** Build a Scene is drag-only. Add tap-to-place:
   tap a tray item to drop it at a free spot in the scene, then the child can
   drag it if they want. Coloring: check the eraser and brush hit areas use
   generous thresholds on small phones.
7. **Consistency sweep.** Every game uses `GameScreen` (Last Letter reuses
   First Letter, which is fine). Check every game's Home button, level chip
   and instruction are in the same place in portrait and landscape, and that
   the completion card always offers the same three actions (Restart, Next
   Game, Home) in the same order.

### Acceptance

Screenshot every game header in portrait on a 360-pt phone and in landscape
on an iPad. No icon-only control in child-facing UI except the language flag
(which shows the language name, and that counts as a label). Reduce motion
verified on the emulator (Settings → Accessibility → Remove animations).

---

## Phase 3: Words and sounds (Teacher Approved category 1)

The biggest remaining gap. **Feedback is text-only.** "Try again!",
"Amazing!" and "You finished all levels!" are shown but never spoken, and a
non-reader only hears a sound effect.

1. **Spoken feedback clips.** Add `assets/sounds/feedback/<english|spanish>/`
   with short, warm lines, each with 3-4 variants so it doesn't get
   repetitive:
   - correct: "Great job!", "You got it!", "Yay!"
   - try again: "Oops, try again!", "Almost! Try again!"
   - level up: "Next level!"
   - all done: "You did it! You finished every level!"
   - hint: "Here's a little help!"

   Play them from `CorrectBurst`, `TryAgainBanner` and `CompletionOverlay`
   through a tiny `utils/feedback-sounds.js` (static `require` table, same
   shape as `instruction-sounds.js`, random variant, missing clip = silence).
   They must not overlap the animal's own sound: queue after it, or skip
   praise when an animal clip is playing.
   **Needs Samil:** the clips must be recorded in the same voice as the
   existing instruction clips (voice-over quality was a rejection reason, so
   don't use on-device TTS). Write the exact script for both languages into
   `docs/plans/feedback-voice-script.md`, wire the code with the table empty
   (silent), then ask the user to record. After recording, normalise every
   clip to -16 LUFS and verify each with the ffmpeg command above.
2. **Respect the Voice setting.** `settings.context` has a voice toggle
   ("Voice (instructions & names)"). The new feedback clips follow it too.
3. **Cut on-screen text.** In each game, any instructional text a child must
   read has a spoken equivalent (most already do via `useInstructionPrompt`).
   Check helper texts that are shown but not spoken
   (`findAnimalHelperText`, `whoseSoundHelperText`, `bandHelperText`,
   `traceInstruction`) and either make them the spoken instruction or remove
   them. Completion subtitle: speak it, or drop it and keep only the big
   title + icons.
4. **Copy and tone review** (`constants/strings.js`, both languages):
   - Fewer words, more exclamation, kid vocabulary. E.g.
     `modeGuessDescription` "Test your knowledge!" reads like a quiz, so use
     something like "Who's that animal?" / "¿Quién es?". `whoseSoundHelperText`
     is 10 words, so cut to about 5.
   - Shorten long Spanish titles (they also cause the wrapping in Phase 1):
     "¿De Quién es Este Sonido?" → "¿De quién es?",
     "Adivina la Primera Letra" → "¿Con qué letra empieza?" or "Primera
     letra", and so on. Keep the shortened title meaning the same as the
     spoken instruction.
   - Spanish uses sentence case, not Title Case ("Entrena tu memoria", not
     "Entrena tu Memoria"). Make it consistent across the Spanish table.
   - Present before/after for every changed string in the PR description.
     The user approves copy.
5. **Audio QA pass.** Run the ffmpeg loudness check over every file in
   `assets/sounds/**` (script it: `scripts/check-loudness.sh`, prints any
   file outside -18…-14 LUFS or with true peak above -1 dBTP). Fix outliers.
   Also listen for clicks at the start and end of the shortest clips.

---

## Phase 4: Engagement and enrichment (keep reward loop coverage)

1. **Animal Band** doesn't call `markAnimalMet`. Every animal tapped in the
   band should count as met (feeds the Album). Consider one star for
   "played your first song" via `markLevelStarred`, but keep it free play
   with no levels and no failure.
2. **Creative modes reward.** Build a Scene and Coloring already mark animals
   met. Add a gentle, non-competitive acknowledgement (sticker or star) the
   first time a child finishes a picture or places 5+ items. Use the existing
   star/badge system in `utils/badges.js`; no new reward currency.
3. **Difficulty by age** is in `constants/difficulty.js`. Check every quiz
   game reads the age band (`under4`, default, `7plus`) the same way, and that
   the 6-8 band gets a real step up (more options, the Trace letter without
   its dotted guide at higher levels, Counting up to 10). The reviewers judge
   the 6-8 band too.
4. **Learn mode** (`components/animals/animal.screen.component.jsx`) doesn't
   use `GameScreen` or `useInstructionPrompt`. Bring it onto the shared frame
   so it has the same header, spoken intro and next-game button.

---

## Phase 5: Final review gate before requesting Teacher Approved

1. Go through every game in both languages, both age bands, portrait and
   landscape, phone and iPad, using the checklist in the project memory
   ("Teacher Approved design standards"). Record a short video per game for
   the user (`npm run record-demo`).
2. Update store screenshots if the UI changed visibly
   (`docs/release/ios/screenshots/`, Play listing).
3. Ship as a minor version, let it run in production at least 2-3 weeks,
   then the user requests the review on or after **Jan 22, 2027**.

---

## Per-game checklist (run for each game in Phases 1-4)

| Check | Pass when |
| --- | --- |
| Text | No word ever hidden (FitText); Spanish + largest font OK |
| Header | Home, Reset, Next and Language all labelled, 16-pt gaps, ≥48 pt |
| Instruction | Spoken on open, replay by tapping, follows Voice setting |
| Feedback | Correct / wrong / complete are seen **and** heard |
| Hint | Appears after N wrong tries (quiz games) |
| Motor | No drag-only or speed-only success path |
| Motion | Reduce motion removes loops and bounces |
| Rewards | Feeds `markAnimalMet` and/or stars where it makes sense |
| Age bands | under4 / default / 7plus feel different |
| Layout | Portrait and landscape, 360-pt phone and iPad |

Games: learn, guess, letter, lastLetter, trace, memory, findAnimal, missing,
whoseSound, buildScene, coloring, band, counting (`constants/games.js`), plus
the world map, main/list menu and Album.

## Things that need the user (don't guess)

- Recording the feedback voice clips (Phase 3.1).
- Approving copy changes, especially shortened titles (Phase 3.4).
- Any new art (Phase 4 stickers): ask before authoring.
- Version number and release timing.
