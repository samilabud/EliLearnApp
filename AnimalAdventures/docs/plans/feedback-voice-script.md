# Feedback voice script (Phase 3.1): for recording

The game now speaks short praise and encouragement, but there is nothing to
play yet. Record these lines in the **same voice as the existing instruction
clips** (voice quality was one of Google's rejection reasons, so no robot
text-to-speech). Short, warm, smiling tone. About 1-2 seconds each.

Save as mp3 in `assets/sounds/feedback/english/` and
`assets/sounds/feedback/spanish/` using the file names below. Then tell me
and I'll normalise each to -16 LUFS, check it with ffmpeg and list it in
`utils/feedback-sounds.js`. The code already plays them after a short delay
so they don't talk over the animal's own sound, and they follow the parent's
Voice setting and speed.

## When a child picks the right answer (`correct1` … `correct3`)

| File | English | Spanish |
| --- | --- | --- |
| correct1 | Great job! | ¡Muy bien! |
| correct2 | You got it! | ¡Lo lograste! |
| correct3 | Yay! | ¡Yupi! |

## When a child picks a wrong answer (`tryAgain1` … `tryAgain2`)

Never scolding: always an invitation to try again.

| File | English | Spanish |
| --- | --- | --- |
| tryAgain1 | Oops! Try again! | ¡Ups! ¡Inténtalo otra vez! |
| tryAgain2 | Almost! Try again! | ¡Casi! ¡Otra vez! |

## When a child finishes every level (`allDone1`)

| File | English | Spanish |
| --- | --- | --- |
| allDone1 | You did it! You finished every level! | ¡Lo hiciste! ¡Terminaste todos los niveles! |

Optional later (not wired yet): "Next level!" / "¡Siguiente nivel!" and
"Here's a little help!" / "¡Te doy una ayudita!".
