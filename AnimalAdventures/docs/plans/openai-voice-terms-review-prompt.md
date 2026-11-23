# Prompt for Claude Desktop: decide if the OpenAI voice clips can ship

Paste everything below the line into Claude Desktop (with web/browser access).

---

I'm about to publish a children's mobile app (ages 2-8, Google Play and the
Apple App Store, in the "Kids" / "Designed for Families" programs). Its spoken
voice clips (praise like "Great job!" and game instructions, English and
Spanish) were generated once with OpenAI's text-to-speech API (model
`gpt-4o-mini-tts`, voice `nova`) and are shipped inside the app as fixed mp3
files. The app does not call OpenAI at runtime, sends nothing to OpenAI from
users' devices, and collects no user data.

Please read the current official terms yourself, from primary sources, and
decide whether this is allowed. Do not answer from memory, and do not guess
when a page won't load: say which page failed and try another route (the
page itself, a cached copy, or the help-center article).

## Read these (and anything they link to that matters)

1. OpenAI Terms of Use (consumer/business terms that apply to API output)
   and the Service Terms, especially the sections on **output**, **ownership
   of output**, and **restrictions**.
2. OpenAI Usage Policies, especially anything about **disclosing AI-generated
   or synthetic voice/audio**, **minors / children**, and **products directed
   to children**.
3. The OpenAI text-to-speech guide (platform docs), for the disclosure
   wording requirement and any voice or model usage notes.
4. The model deprecation / shutdown notice for `gpt-4o-mini-tts` (a shutdown
   date of 6 Jan 2027 was mentioned; confirm it, and say whether already
   generated audio may still be used after that).
5. Google Play's policy on AI-generated content and the Families policy, and
   Apple's App Store Review Guidelines (sections on kids apps and on
   AI-generated content), only for anything that applies to shipped
   synthetic voices.

## Answer these questions, each with a short quote and the URL

- May I use the generated audio **commercially** in a published, paid app?
- Who **owns** the output, and may I **redistribute** it inside an app?
- Is **attribution** required?
- Is there a **required disclosure** that the voice is AI-generated? If yes:
  the exact wording or rule, and where it must appear (in the app, in the
  store listing, both?). Is a line in the app's settings/About screen enough?
- Are there **restrictions for children's apps** (for example a minimum age,
  a ban on products directed to children, or extra requirements)? Does it
  matter that the audio is pre-generated and no child data goes to OpenAI?
- Does anything in the policies make shipping these clips a **violation of
  Google Play or Apple rules** (for example synthetic-voice disclosure)?
- What happens after `gpt-4o-mini-tts` is shut down: can the existing mp3
  files keep shipping?

## Give me a decision

End with exactly one of:

- **GO**: safe to ship as is.
- **GO WITH CHANGES**: safe if I add specific things (list each, for example
  an exact disclosure line and where to put it).
- **NO-GO**: not allowed; say why and what I would need to do instead.

Then list the page titles, URLs and the date you read each one. If any
important page could not be read, say so plainly and lower your confidence
accordingly; do not fill the gap with a guess. Do not log in to anything,
do not send any of my files anywhere, and do not change any files.
