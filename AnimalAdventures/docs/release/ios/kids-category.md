# Kids Category & Age Band — Animal Adventures

## Recommendation: select both "Ages 5 & Under" and "Ages 6-8"

**Why both bands, not just one:** the app's own marketing copy and content span roughly ages 2-7. Mapping the actual games to Apple's bands:

- **Ages 5 & Under fits cleanly:** Learn Animal Sounds & Names, Guess the Animal, Train Your Memory, Find the Animal, Whose Sound Is It?, Build a Scene, Coloring Book, Count the Animals — all pure recognition/audio/motor-skill tasks, no reading required.
- **Ages 6-8 fits the two letter-literacy games:** Guess the First Letter and Trace the Letter both assume some beginning-reader skill (matching/tracing letters), which is a step up from the Ages 5 & Under games but still squarely early-elementary, not upper-elementary (9-11) content.

**Not recommending Ages 9-11:** none of the content (animal sounds, letter tracing, counting, coloring) is complex or engaging enough for that band, and Apple's reviewers check that a selected band's content/complexity is actually appropriate for it — claiming 9-11 for this app would be a mismatch, not a benefit.

## What selecting Kids Category commits you to

Once you pick Kids Category in App Store Connect, Apple holds the app to stricter rules than a normal app, consistent with what we already verified in `docs/release/ios-readiness.md`:
- No third-party analytics or advertising (confirmed: none in the codebase)
- No external links reachable by a child without a parental gate (confirmed: the one external link — PayPal donate — doesn't exist in the iOS build at all; Android-only)
- Human-reviewed content appropriate for the selected age band(s)

App Store Connect will also ask you to confirm these practices directly as part of enabling Kids Category — expect a short compliance questionnaire (exact wording varies by App Store Connect version) asking you to attest to things like "no third-party analytics" and "no behavioral advertising." Everything we found supports answering those truthfully in the app's favor.
