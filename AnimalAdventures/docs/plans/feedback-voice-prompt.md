# Prompt for Claude Desktop: generate the feedback voice clips

Paste everything below the line into Claude Desktop (with access to this
repo folder and a terminal).

---

You're helping me finish a children's app (ages 2-8, English and Spanish).
I need 12 short spoken voice clips. Work in the folder
`/Users/samilabud/code/EliLearnApp/AnimalAdventures`. Do not change any code
and do not make git commits; you only create audio files.

## The lines

Read `docs/plans/feedback-voice-script.md`. It lists the 6 English and 6
Spanish lines and the exact file names (`correct1`..`correct3`,
`tryAgain1`..`tryAgain2`, `allDone1`). Save them as mp3 in:

- `assets/sounds/feedback/english/`
- `assets/sounds/feedback/spanish/`

## Step 1: pick the voice (stop and ask me)

The voice must sound warm, smiling and kid-friendly, and as close as
possible to the existing instruction clips in
`assets/sounds/instructions/english/` and `.../spanish/` (I will listen to
those; you can't). Use a text-to-speech service with natural neural voices
and terms that allow **commercial use in a published app**. In order of
preference:

1. A service I already have a key for (ask me: ElevenLabs, Google Cloud
   Text-to-Speech, Azure Speech or OpenAI TTS). Never print, log or commit
   the key; read it from an environment variable.
2. If I have none, the free `edge-tts` Python package (no key) can make
   **drafts only**: it uses an unofficial Microsoft endpoint, so tell me
   plainly that its terms for commercial use are unclear and the final
   clips should be regenerated with a licensed service.

Before generating all 12, make the line "Great job!" / "¡Muy bien!" with
2-3 candidate voices per language (calm and friendly, slightly higher
pitch, not a news-reader). Save them in a scratch folder outside the repo,
tell me their paths, and **wait for me to choose**. Spanish should be
neutral Latin American.

## Step 2: generate and clean up

With the chosen voice, make all 12 clips at a slightly slow, cheerful pace.
Then, for every file:

- Mono, 44.1 kHz, mp3, about 128 kbps.
- Trim leading/trailing silence, keeping about 40 ms before and 120 ms
  after, plus a 20 ms fade in and out so there are no clicks.
- Normalise to about -16 LUFS with a true peak below -1.5 dBTP:
  `ffmpeg -i in.mp3 -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 out.mp3`
  (run it two-pass: measure first, then apply with the measured values).
- Keep each clip under 3 seconds.

## Step 3: verify and report

- Run `bash scripts/check-loudness.sh assets/sounds/feedback` and fix any
  file it flags.
- Confirm all 12 files exist with the exact names, and list each with its
  duration and measured LUFS.
- Tell me which service and voice names you used, and whether the result is
  draft-only (unlicensed) or final.
- Do not edit `utils/feedback-sounds.js`; I will wire the files in.

## Part B: re-record 4 instruction clips (8 files)

The on-screen instruction text changed for four modes, so their spoken
clips must say the new line. **Use the same voice you chose in Step 1 only
if it matches the existing instruction clips; otherwise tell me first**,
because these sit next to the other 9 instruction clips per language and a
different voice would sound odd.

Back up each current file to a scratch folder outside the repo, then
overwrite it (same file name, same cleanup and loudness rules as Step 2):

| File (in `assets/sounds/instructions/<english or spanish>/`) | English line | Spanish line |
| --- | --- | --- |
| `whoseSound.mp3` | Who makes this sound? Tap it! | ¿Quién hace este sonido? ¡Tócalo! |
| `letter.mp3` | First letter? Tap it! | ¿Con qué letra empieza? |
| `lastLetter.mp3` | Last letter? Tap it! | ¿Con qué letra termina? |
| `buildScene.mp3` | Tap or drag animals to build your scene! | ¡Toca o arrastra animales para crear tu escena! |

Run `bash scripts/check-loudness.sh assets/sounds/instructions` afterwards
and report each file's duration and LUFS.
