# Animal Adventures: Research on a playful, map-style menu

*Research brief to hand to Claude Code. No app code here. Researched 2026-11-12.*

---

## 0. What the research says, in brief

1. **Use one axis, horizontally.** Kids' apps converge on horizontal movement through a "world" of big, character-led, unlabeled targets, with audio when a target is tapped. Two-dimensional free panning and pinch-zoom are rare at the 2–6 age range.
2. **Tap is reliable from about age 2. Swipe and slide come next. Pinch and precise drag-and-drop are unreliable until about age 4 or later.** NN/g recommends touch targets of about **2 cm × 2 cm**, roughly four times the adult size, and offering a tap alternative to any precise drag.
3. **The stores judge navigation.** Google's Teacher Approved reviewers explicitly score whether "buttons, menu, navigation, and required gestures" are easy for the target age. Apple 1.3 forbids links out of the app and commerce unless they sit behind a parental gate.
4. **For your stack:** you don't need gesture-handler or Skia for the recommended path. A paged `Animated.ScrollView` from Reanimated with `useAnimatedScrollHandler` gives you parallax. A custom overlay in `App.jsx` gives you a "zoom into the landmark" transition. Reanimated's shared-element transitions are still **experimental, behind a feature flag, and tied to the native stack**, so avoid them.

**What I'm unsure of:** I couldn't find published teardowns of Toca Boca, Sago Mini, Khan Kids and the other apps on their navigation. Statements about those apps come from my own knowledge of them, not from sources fetched for this report, and are marked *(unverified)*. Check them by installing the apps.

---

## 1. Patterns in the reference apps *(unverified, from general knowledge)*

| App | Home navigation | Pattern to borrow |
|---|---|---|
| Toca Boca World | A horizontally scrolling map of locations. You tap a building to enter it. | A world built from places. Scrolling is horizontal only. |
| Sago Mini World | A horizontally scrolling row of large character "portals". A third-party review criticizes the hub for adding about **3 taps of friction**. | Keep the path from launch to a game at one or two taps. |
| Khan Academy Kids | A character-guided learning path plus a library. Khan says it "minimizes written language" in favor of icons and animation, with audio instructions. | Use characters as navigation and voice-over on tap. |
| Endless Alphabet | A horizontal strip of words with monsters. | One long horizontal strip. Each item is a big object. |
| PBS Kids Games | A horizontal carousel of character tiles. | Characters stand in for labels. |
| Lingokids | An island or path map showing progress. | A progress trail. |
| Duck Duck Moose | A single simple scene with few targets. | Fewer, bigger targets. |

**Recurring patterns:** one scroll axis (horizontal), big targets that are animals or objects, no reliance on text, a sound or voice on every tap, a mascot as guide, a visible sense of progress, and a parent area behind a gate.

---

## 2. Child-UX findings that constrain the design

- **Target size.** NN/g recommends at least 2 cm × 2 cm. That's about 126 dp on Android, where 1 dp is 1/160 inch, and a similar size in points on iPhone. Landmark *art* can be smaller if you enlarge the **hit area** with `hitSlop` or a transparent wrapper.
- **Gestures by age.** Two-year-olds can tap and drag and pick up flick quickly. They struggle with drag-and-drop and pinch. One study found only about 27% of 2–3-year-olds could tap an intended spot on a prompt. By age 4 most children can learn all common gestures. Pinch, zoom and rotate are still hard up to about age 8.
- **Precise dragging frustrates children.** Offer tap alternatives such as arrow buttons. NN/g also advises against two-handed actions and fast reactions for children under 5.
- **Accidental touches.** UX Magazine recommends "childproof" navigation so that brushing the menu doesn't trigger it, and cites swipe-to-navigate confusing children in one app. NN/g documents mis-taps that sent children out of an app, to the store, so they gave up.
- **Discoverability for pre-readers.** Children won't infer that a scene "continues off-screen" unless something shows it: a partly visible next page, a bouncing arrow, or a mascot that points or walks.

---

## 3. Concepts, from lowest to highest effort

### A. Swipeable "world pages" with parallax (Effort: **S**)
- **What it is.** Each of the 4 categories becomes a full-screen illustrated page: Listen is the jungle, Letters the farm, Memory the ocean and Create the arctic. The child swipes horizontally between pages. The existing game tiles become landmarks at fixed positions on each page. Background layers move at different speeds. Big arrow buttons sit at both edges, and animal-head page dots sit at the bottom.
- **References.** PBS Kids and Endless Alphabet-style horizontal paging *(unverified)*. [Parallax with Reanimated tutorial](https://dev.to/amitkumar13/parallax-scroll-effect-in-react-native-with-reanimated-8fj).
- **Tech.** Use Reanimated's `Animated.ScrollView` with `horizontal` and `pagingEnabled`, and track `scrollX` with `useAnimatedScrollHandler`. Each layer gets `translateX = interpolate(scrollX, …) * factor`, with factors around 0.2, 0.5 and 1.0. Use 3 layers per page. Use flat SVG with few paths, or pre-rendered WebP. **No new libraries.**
- **Risks for ages 2–6.** A child may not discover the swipe, so add arrows, a 10–15% peek of the next page and a first-run nudge. Edge swipes can collide with the Android back gesture. There are only 4 pages, so getting lost isn't a real risk.

### B. "Zoom into the landmark" open and close transition (Effort: **S–M**)
- **What it is.** When a landmark is tapped, it bounces and plays a sound. A circle in the landmark's color then grows from that spot to fill the screen, and the game fades in underneath. Closing the game reverses the circle back to the landmark.
- **References.** The circular reveal common in kids' apps and in Material motion.
- **Tech.** This fits your `currentMode` architecture. Call `measureInWindow` on the tapped landmark and store its rectangle. An absolutely positioned overlay in `App.jsx` animates `scale` from that rectangle to the full screen. You switch `currentMode` under the overlay at the midpoint, then fade the overlay out. Closing reverses it with the stored rectangle. This replaces the 350 ms fade only for menu-to-game transitions. **Avoid Reanimated shared-element transitions.** They're still experimental behind `ENABLE_SHARED_ELEMENT_TRANSITIONS` and work only with the native-stack navigator.
- **Risks.** Low. Keep the transition short, about 400–600 ms in total, or impatient children will tap again. Ignore taps while it runs.

### C. "Alive world" details layer (Effort: **S–M**, and it adds onto A)
- **What it is.**
  - 1–3 small idle animals per page. Tapping one makes it react and play a sound.
  - Visited landmarks get a paw-print stamp or flag, and a dotted trail connects them.
  - A day or night tint follows the device clock.
  - Occasional ambient touches, such as a bird crossing the sky.
- **Tech.** Use your existing small Lottie files for the animals, and **pause Lottie on pages that aren't visible**. Store the visited state locally with AsyncStorage or your existing storage, and never send it anywhere. The day/night effect is a tinted overlay whose opacity follows the hour, rather than new art. Keep the number of continuously animated nodes low. Reanimated advises at most about **100 animated components on low-end Android**.
- **Risks.** Too many reactive things on screen distract children from the game landmarks. Make the game landmarks visibly the "big" targets, for example with a pulsing glow or a bigger size, and make decorative animals smaller. A trail of visited places shouldn't feel like failure for places a child hasn't visited yet.

### D. One continuous horizontal panorama, with the mascot walking to the chosen spot (Effort: **M**)
- **What it is.** Instead of 4 pages, the menu is one long strip, about 3–5 screens wide, with all 11 games plus the Album along it. Biomes blend into each other. When a child taps a landmark, the dog runs or hops to it in about 600 ms, then concept B's zoom plays. The page snaps or auto-scrolls to keep the dog on screen.
- **References.** Toca Boca World's location map and Lingokids' path *(unverified)*.
- **Tech.** Use the same ScrollView and parallax as A, without paging or with soft snapping per biome. The dog is a Reanimated-driven `translateX/Y` along a simple path with a hop arc and a Lottie walk cycle. A tap during the walk skips straight to the game.
- **Risks.** Children may scroll past landmarks, so add snap points and "home" or "next" buttons. The strip needs more art and more texture memory. The mascot walk adds delay, so it must be skippable and off under reduced motion.

### E. Fully pannable and zoomable 2D world map (Effort: **L**)
- **What it is.** One large illustrated island the child drags in any direction and pinches to zoom, with landmarks scattered around it.
- **Tech.** Add `react-native-gesture-handler` with `Gesture.Pan()` and `Gesture.Pinch()` on a Reanimated transform, with clamped bounds and spring-back. Optionally use Skia to render the map. Skia adds about **4 MB to the download on Android and 6 MB on iOS**, plus about 220 KB of JavaScript. You'd need tiling or downsampling for large bitmaps. As a rule, a 4096 × 4096 RGBA bitmap takes about 64 MB of memory.
- **Risks.** This is the highest-risk option for ages 2–6. Pinch is unreliable before about age 4, and children get lost on a 2D map. You'd need a minimap or a home button. Placing hit targets is fiddly at different zoom levels. The art workload is large, and so is the testing load across phone, tablet, portrait and landscape. **I don't recommend it for this audience.**

---

## 4. Recommendation

**Build A + B + C now, and add D's mascot walk later. Skip E.**

Single-axis paging matches what children aged 2–6 can do and what successful kids' apps do. It maps onto your existing 4 categories, needs no new native libraries, stays at 60 fps on mid-range Android, and keeps the art budget to about 4 scenes × 3 layers.

### Staged plan (each stage ships on its own)

| Stage | Ships | Notes |
|---|---|---|
| **0. Menu toggle** | The current tile menu becomes the "list view". A preference toggles between map and list. | Put the toggle in the parent area or behind a simple parental gate so children don't flip it by accident. Default to the map. If a screen reader is on, consider defaulting to the list. |
| **1. World pages** | A horizontal pager with 4 biome pages, each with 3 parallax layers. The existing Lottie tiles become landmarks with big hit areas. Edge arrow buttons, animal page dots and a peek of the next page are included. On first launch the pager auto-nudges about 40 px and back. | No new libraries. Tapping a landmark opens the game with the current fade. |
| **2. Zoom transition** | The circle reveal from the landmark into the game, reversed on close. | An overlay in `App.jsx`. The menu needs to remember which page the child was on. |
| **3. Alive details** | Idle animals with tap reactions and sounds, visited stamps and trail, and the day/night tint. | Pause animations on hidden pages. Everything is stored locally. |
| **4. Mascot guide** | The dog hops to the chosen landmark before the zoom. Optionally, the dog points to an unvisited place after a period of inactivity. | Tapping skips it. It's off under reduced motion. |
| **5. Optional** | Merge the pages into one continuous panorama (concept D), or add more worlds. | Only do this if playtesting shows children want more space. |

### Implementation notes for Claude Code
- **Parallax.** Drive all layers from one `scrollX` shared value. Give each page 3 layers, not 3 per landmark. Precompute layer widths per orientation using `useWindowDimensions`, and re-snap to the current page on rotation.
- **Assets.** Prefer flat SVG with few paths. Complex SVG with gradients and filters renders slowly on Android. Rasterize anything detailed to WebP and keep each layer to about 2× the screen height. Measure the APK before and after.
- **Lottie.** Avoid using it as a full-screen background. Masks and mattes in large Lottie files perform poorly on Android, and the underlying library has a hardware/software `renderMode` trade-off. Keep Lottie to small sprites.
- **Android back.** Handle `BackHandler` on the menu so that an edge-swipe back gesture goes to the previous page or does nothing, and **never exits the app** unexpectedly. Inside a game, back returns to the menu.
- **Tap guarding.** Ignore taps while a page is moving and while a transition runs. Debounce double taps on landmarks.

---

## 5. Accessibility

- **Reduced motion.** Reanimated animations default to `ReduceMotion.System`, so they skip when the operating system setting is on. Also check the setting yourself to switch off parallax, the auto-nudge, the mascot walk and the circle reveal; under reduced motion, use a plain short crossfade. Reanimated's `useReducedMotion` reads the value at startup only. To pick up changes, listen to `AccessibilityInfo`'s `reduceMotionChanged` event.
- **Screen readers.**
  - Every landmark gets `accessible`, `accessibilityRole="button"` and a localized `accessibilityLabel` in English and Spanish, such as "Memory game: animal pairs".
  - Decorative animals get `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` unless they do something.
  - Arrow buttons are labeled "Next world: Ocean".
  - Consider auto-switching to the list view when `isScreenReaderEnabled` is true.
- **A fallback when a child doesn't find the swipe.** Use always-visible arrow buttons, a peek of the next page, a first-run nudge, and tappable page dots. A child can reach every game without swiping.
- **Touch targets.** Aim for about 2 cm, around 120 dp or pt. Space landmarks generously, and keep decorative tap targets away from game landmarks.

---

## 6. Safety and compliance flags (Google Play Families and Apple Kids Category)

| Item | Status |
|---|---|
| **External links or "more apps" landmarks** | ❌ Don't put any on the map. Apple 1.3 forbids links out of the app unless they sit behind a parental gate that can't be disabled. Cross-promotion is also something Teacher Approved reviewers look at. |
| **Visited trail and progress** | ✅ Fine if it's stored only on the device. ❌ Don't add analytics SDKs to measure "map engagement". Apple's Kids Category forbids third-party analytics and sending data to third parties. |
| **List-view toggle and parent settings** | ⚠️ Gate them, so children don't switch modes or reach settings by accident. Gates are mandatory only for links out and commerce, but gating this is good practice. |
| **Edge swipes and the back gesture** | ⚠️ Make sure a mis-swipe can't leave the app. That's the kind of "confusing gesture" a reviewer would flag. |
| **Pinch and 2D pan (concept E)** | ⚠️ This risks the "required gestures are easy for the age group" criterion in Teacher Approved reviews. |
| **AI-generated art** | ⚠️ This is allowed as assets, but don't imitate existing kids' brands or characters, and check the generator's terms for commercial use. |
| **New libraries** | ✅ Reanimated, react-native-svg, Lottie and gesture-handler collect no data. Avoid any library that does. |

---

## 7. Pitfalls and maintenance

- **Getting lost or not finding a game.** Paging (concept A) mostly removes this risk. Keep 2–4 games per page, put landmarks in the middle 80% of the screen, and add a "home" dog button that returns to page 1.
- **Scrolling past tiles.** With paging and snapping, the pager always lands on a full page.
- **Accidental game launches mid-swipe.** ScrollView already cancels the touch when a swipe begins, but also guard taps while the pager is moving.
- **Orientation and tablets.** Design each scene for a wide aspect ratio. In portrait, anchor landmarks with percentages, or switch to a 2-row arrangement. Test on four configurations: phone and tablet, each in portrait and landscape.
- **Solo maintenance.** Keep the scene declarative: a single `worlds.js` config holding each page's layers, its landmarks as `{gameId, x%, y%, lottie, color}`, its ambient animals and its sounds. Adding a game is then a one-line config change. Layout and art then stay separate from the code.
- **Bundle size.** 4 scenes × 3 WebP layers at about 100–300 KB each comes to roughly 1–3 MB. Skia would add about 4–6 MB on its own, which is another reason to skip it.

### Producing the art cheaply (you're not an illustrator)
1. **Flat geometric layers you draw yourself** in Figma, Inkscape or Affinity: a sky gradient, two hill or wave silhouettes and a ground band per biome. Parallax makes simple shapes look rich. This is the cheapest option and gives you the smallest SVGs.
2. **CC0 packs.** Kenney (kenney.nl) is public domain and free for commercial use with no attribution required. It includes a Map Pack of 180 assets. The style is simple and toy-like. Check that it fits your Lottie icons.
3. **Licensed vector packs** from Envato Elements, Freepik Premium or Creative Market. Read the licenses for use in apps and distribution.
4. **AI-assisted.** Generate backgrounds in one consistent style using a fixed prompt and a reference image. Then simplify or trace them to vector, or export them as flattened WebP. Retouch for consistency, and check the tool's commercial terms.
5. **Reuse your existing Lottie icons** as the landmarks, so the scene only needs backgrounds.

---

## 8. Open questions to answer before building

1. Should each category map to one biome, for example Listen as the jungle, Letters as the farm, Memory as the ocean and Create as the arctic? Or do you want more worlds than categories?
2. Where does the Album live? It could be a "treasure chest" landmark on every page, or a fixed button.
3. Should the map be the **default** for everyone, with the list in the parent area? Or should the list stay the default for the first version?
4. Which is the lowest-end Android device you'll test on? Can you get one?
5. Do you have 2–6-year-olds who can playtest Stage 1, so you can watch whether they find the swipe and the arrows?
6. What art direction do you want: a flat geometric style to match your Lottie icons, or more illustrated? Do you have a budget for a pack, or will you go DIY or CC0 only?
7. Will the scene layout in tablet landscape differ from phone portrait, or should it be one layout that scales?
8. Do you have narration or voice-over in English and Spanish for landmark names, so pre-readers hear what each one is when they tap it? Or should tapping play only sound effects?
9. Is there a parental gate in the app already that the list toggle can reuse?
10. Is the New Architecture enabled? It's required by Reanimated 4, so it presumably is.

---

## 9. Sources

**Child UX**
- NN/g, Children's UX: physical development, covering the 2 cm targets, dragging and the age table: https://www.nngroup.com/articles/children-ux-physical-development/
- UX Magazine, Designing experiences for young kids, on childproof navigation and swipe confusion: https://uxmag.com/articles/designing-experiences-for-young-kids
- UXPA, Playful Interfaces, on drag-and-drop under 5 and tap-and-tap alternatives: https://oldmagazine.uxpa.org/?p=11776
- Anthony et al., IJCCI 2016, on gesture interaction and feedback for children: https://lisa-anthony.com/wp-content/uploads/2016/06/anthony-et-al-ijcci2016-preprint.pdf
- Gesture studies of preschoolers: https://riunet.upv.es/bitstream/10251/77963/4/shortpaperVersionAutor.pdf and https://aircconline.com/ijma/V10N6/10618ijma14.pdf
- Kidscreen, mobile app design and preschoolers: https://kidscreen.com/?p=73678

**Reference apps**
- Khan Academy Kids, English language acquisition, on minimal text and icons: https://blog.khanacademy.org/supporting-english-language-acquisition-with-khan-academy-kids/
- Khan Academy Kids accessibility statement: https://khankids.zendesk.com/hc/en-us/articles/4914881968283-Our-Accessibility-Statement
- Sago Mini World review, including the critique of hub friction (third-party): https://toddler-games.pages.dev/review/sago-mini-world-the-calmer-cousin-to-toca-boca-by-design-and-by-economics
- Sago Mini World on the App Store: https://apps.apple.com/app/874425722

**Store policies**
- Google Play Teacher Approved: https://play.google.com/console/about/programs/teacherapproved/
- Interview with Google Play's UX lead on Teacher Approved: https://joanganzcooneycenter.org/2020/07/24/google-play-teacher-approved/
- Google Play Families Self-Certified Ads SDK policy: https://support.google.com/googleplay/android-developer/answer/12918983
- Apple parental gates: https://developer.apple.com/app-store/parental-gates/
- Apple App Review Guidelines, 1.3 Kids Category; read the current text on the official page: https://developer.apple.com/app-store/review/guidelines/
- Apple developer forum, Kids Category rejections: https://developer.apple.com/forums/thread/813791

**Technology**
- Reanimated 4.2 release, with shared-element transitions behind a flag: https://swmansion.com/blog/introducing-reanimated-4-2-0-71eea21ca861/
- Reanimated 4.7.0 notes, where they're still experimental: https://newreleases.io/project/npm/react-native-reanimated/release/4.7.0
- Reanimated shared-element transitions overview: https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview
- Reanimated performance guide, including the limit of about 100 animated components on low-end Android: https://docs.swmansion.com/react-native-reanimated/docs/guides/performance
- Reanimated accessibility and reduced motion: https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility and https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion
- Parallax with Reanimated tutorial: https://dev.to/amitkumar13/parallax-scroll-effect-in-react-native-with-reanimated-8fj
- React Native Skia bundle size: https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size
- Expo SDK 57 Skia docs: https://docs.expo.dev/versions/v57.0.0/sdk/skia
- Margelo, Skia and Reanimated on low-end Android: https://margelo.com/blog/profiling-skia-reanimated-low-end-android
- lottie-android RenderMode trade-offs: https://skia.googlesource.com/external/github.com/airbnb/lottie-android/+/88bed53078a691b2f0b1eafb3d32071ab5cdb779
- react-native-skottie, a Skia-based Lottie player: https://github.com/margelo/react-native-skottie

**Art assets**
- Kenney license (CC0): https://kenney.nl/support
- Kenney Map Pack: https://opengameart.org/content/map-pack-180-assets
