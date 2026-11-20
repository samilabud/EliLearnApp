# Copy proposals (Phase 3.4): for your approval

Nothing here is applied yet. Tell me which rows to apply (all, none, or a
list) and I'll change `constants/strings.js`. The goals are fewer words,
kid vocabulary, a warm tone, shorter Spanish titles (they are the ones that
wrapped and got cut off) and sentence case in Spanish.

**Important:** several strings are also *spoken* by recorded instruction
clips in `assets/sounds/instructions/`. Changing the text without
re-recording makes the screen and the voice disagree. Rows marked 🎙 need a
new recording in that language.

## Titles (shown on the map, menu tiles and cards)

| Key | Now (EN) | Proposed (EN) | Now (ES) | Proposed (ES) |
| --- | --- | --- | --- | --- |
| modeLearnTitle | Learn Animal Sounds & Names | Animal Sounds & Names | Aprende Sonidos y Nombres | Sonidos y nombres |
| modeGuessTitle | Guess the Animal | Guess the Animal | Adivina el Animal | Adivina el animal |
| modeMemoryTitle | Train Your Memory | Memory Match | Entrena tu Memoria | Memoria |
| modeLetterTitle | Guess the First Letter | First Letter | Adivina la Primera Letra | Primera letra |
| modeLastLetterTitle | Guess the Last Letter | Last Letter | Adivina la Última Letra | Última letra |
| modeTraceTitle | Trace the Letter | Trace the Letter | Traza la Letra | Traza la letra |
| modeFindAnimalTitle | Find the Animal | Find the Animal | Encuentra al Animal | Encuentra al animal |
| modeMissingTitle | What's Missing? | What's Missing? | ¿Qué falta? | ¿Qué falta? |
| modeBandTitle | Animal Band | Animal Band | Banda de Animales | Banda animal |
| modeWhoseSoundTitle | Whose Sound Is It? | Whose Sound? | ¿De Quién es Este Sonido? | ¿De quién es? |
| modeBuildSceneTitle | Build a Scene | Build a Scene | Crea una Escena | Crea una escena |
| modeColoringTitle | Coloring Book | Coloring Book | Libro para Colorear | Colorea |
| modeCountingTitle | Count the Animals | Count the Animals | Cuenta los Animales | Cuenta animales |

Other Spanish Title Case to sentence case: `Reproducir Sonido` → `Escuchar el sonido`,
`Escuchar el Nombre` → `Escuchar el nombre`, `Menú Principal` → `Menú principal`,
`Siguiente Juego` → `Siguiente juego`, `Jugar de Nuevo` → `Jugar otra vez`,
`Intentar de Nuevo` → `Probar otra vez`, `Álbum de Animales` → `Álbum de animales`,
`Estrellas Ganadas` → `Estrellas ganadas`, `Libro para Colorear` (above).

## Descriptions (menu list and screen-reader text)

| Key | Now (EN) | Proposed (EN) | Now (ES) | Proposed (ES) |
| --- | --- | --- | --- | --- |
| modeGuessDescription | Test your knowledge! | Who is making that sound? | ¡Pon a prueba tu conocimiento! | ¿Quién hace ese sonido? |
| modeLetterDescription | Match animals to their first letter! | Which letter does it start with? | ¡Relaciona animales con su primera letra! | ¿Con qué letra empieza? |
| modeLastLetterDescription | Match animals to their last letter! | Which letter does it end with? | ¡Relaciona animales con su última letra! | ¿Con qué letra termina? |
| modeMissingDescription | Look at the animals, then spot who went away! | Who went away? | ¡Mira a los animales y descubre quién se fue! | ¿Quién se fue? |
| modeBuildSceneDescription | Drag animals to make your own scene! | Tap animals to make a scene! | ¡Arrastra animales para crear tu escena! | ¡Toca animales para crear tu escena! |

## Instructions shown in games (🎙 means a spoken clip exists)

| Key | Now (EN) | Proposed (EN) | Now (ES) | Proposed (ES) |
| --- | --- | --- | --- | --- |
| whoseSoundHelperText 🎙 | Listen, then tap the animal that makes this sound! | Who makes this sound? Tap it! | ¡Escucha y luego toca el animal que hace este sonido! | ¿Quién hace este sonido? ¡Tócalo! |
| whichLetter 🎙 | What letter does this animal's name start with? | First letter? Tap it! | ¿Con qué letra empieza el nombre de este animal? | ¿Con qué letra empieza? |
| whichLastLetter 🎙 | What letter does this animal's name end with? | Last letter? Tap it! | ¿Con qué letra termina el nombre de este animal? | ¿Con qué letra termina? |
| buildSceneEmptyHint 🎙 | Tap or drag animals to build your scene! (already updated for tap-to-place; the recorded clip still says "drag") | same | ¡Toca o arrastra animales para crear tu escena! (same note) | same |

## Tone

`Game Over` / `Juego Terminado` (key `gameOver`) sounds like losing. If it is
shown anywhere child-facing, change it to `All done!` / `¡Terminamos!`. I
did not find it on a child screen, so I left it.

## Not changing

Parent-area text, the privacy and about copy, and the accessibility labels
read by screen readers.
