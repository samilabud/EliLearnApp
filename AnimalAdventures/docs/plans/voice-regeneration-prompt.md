# Prompt for Claude Desktop: one licensed voice for every clip

Why: the 12 feedback clips (edge-tts Ana/Dalia) do not match the 26
instruction clips, and edge-tts is unlicensed for a published app. Fix both at
once: re-voice **all 38 clips** (13 instructions + 6 feedback, x EN/ES) with one
licensed voice per language. Supersedes Part A/B of `feedback-voice-prompt.md`.

Paste everything below the line into the Claude Desktop conversation.

---

Work in `/Users/samilabud/code/EliLearnApp/AnimalAdventures`. You only create
audio files. Do not change code and do not commit. Never print, log or commit
an API key; read it from an environment variable.

## Why we are doing this

The feedback clips you made (Ana/Dalia) do not sound like the existing
instruction clips, and edge-tts has unclear commercial terms. We will replace
ALL 38 clips with one licensed voice per language so the app sounds like one
person.

## Step 1: voice and service (stop and ask me)

Ask which licensed service I have a key for (ElevenLabs, Google Cloud TTS,
Azure Speech or OpenAI TTS). Do not use edge-tts. Offer 2-3 candidate voices
per language (warm, smiling, kid-friendly, slightly higher pitch, not a
news-reader; Spanish neutral Latin American). Render "Great job!" / "¡Muy
bien!" with each, save to a scratch folder outside the repo, give me the
paths, and **wait for me to choose**.

## Step 2: get every line (show me before generating)

1. The 13 modes per language are: learn, guess, letter, lastLetter, trace,
   memory, findAnimal, missing, band, whoseSound, buildScene, coloring,
   counting. Current files: `assets/sounds/instructions/<english|spanish>/<mode>.mp3`.
2. Transcribe the 26 existing instruction clips with a LOCAL speech-to-text
   tool (e.g. `whisper` / `faster-whisper`; do not upload audio anywhere).
3. Use these NEW lines for four modes (the on-screen text changed):

| Mode | English | Spanish |
| --- | --- | --- |
| whoseSound | Who makes this sound? Tap it! | ¿Quién hace este sonido? ¡Tócalo! |
| letter | First letter? Tap it! | ¿Con qué letra empieza? |
| lastLetter | Last letter? Tap it! | ¿Con qué letra termina? |
| buildScene | Tap or drag animals to build your scene! | ¡Toca o arrastra animales para crear tu escena! |

4. For the other 9 modes per language keep the transcribed wording. Compare
   with the on-screen text in `constants/strings.js` and tell me about any
   difference.
5. The 12 feedback lines are in `docs/plans/feedback-voice-script.md`.

Show me one table (file, English line, Spanish line) for all 38 clips and
**wait for my OK**.

## Step 3: generate and clean up

Back up the current 26 instruction clips and 12 feedback clips to a scratch
folder outside the repo first. Then, per file: mono, 44.1 kHz, mp3, ~128 kbps;
trim silence keeping ~40 ms before and ~120 ms after, 20 ms fades; two-pass
`loudnorm=I=-16:TP=-1.5:LRA=11`; under 3 seconds (if a line runs over, speed
the pace up slightly rather than cutting words). Same cheerful, slightly slow
pace across all clips. Overwrite files with the same names and folders.

## Step 4: verify and report

- `bash scripts/check-loudness.sh assets/sounds/feedback` and
  `bash scripts/check-loudness.sh assets/sounds/instructions`; fix any flag.
- Table of all 38 files: duration, LUFS, true peak. Flag any over 3 s.
- Say which service and voice names you used, and confirm the licence allows
  use in a published app for children (quote the relevant terms).
- Do not edit `utils/feedback-sounds.js` or `utils/instruction-sounds.js`; the
  file names are unchanged so nothing needs rewiring.
