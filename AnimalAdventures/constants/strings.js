// Centralised UI copy. Add a language by adding a key block below - no
// component changes required.
export const STRINGS = {
  en: {
    // Main menu
    appTitle: 'Animal Adventures',
    chooseAdventure: 'Choose your adventure!',
    modeLearnTitle: 'Learn Animal Sounds & Names',
    modeLearnDescription: 'Discover animals and their sounds',
    modeGuessTitle: 'Guess the Animal',
    modeGuessDescription: 'Test your knowledge!',
    modeMemoryTitle: 'Train Your Memory',
    modeMemoryDescription: 'Find matching animal pairs!',

    // Shared navigation
    back: 'Back',
    mainMenu: 'Menu',
    mainMenuFull: 'Main Menu',
    reset: 'Reset',
    level: 'Level',

    // Guess the Animal
    playSound: 'Play Sound',
    whichAnimal: 'Which animal makes this sound?',
    amazing: 'Amazing!',
    finishedAllLevels: 'You finished all levels!',
    restart: 'Restart',
    gameOver: 'Game Over',
    tryAgain: 'Try Again',

    // Memory game
    memoryGame: 'Memory Game',
    moves: 'Moves',
    findPairs: 'Find matching animal pairs! ({count} cards)',
    levelComplete: 'Level Complete!',
    movingToLevel: 'Moving to level {level}...',
    completedAllMemoryLevels: 'You completed all memory levels!',
    playAgain: 'Play Again',

    // Animal album
    albumTitle: 'Animal Album',
    albumDescription: 'See every animal you have met!',
    albumProgress: '{met} of {total} animals met',
    albumHintEmpty: 'Play any game to start meeting animals!',
    notMetYet: 'Not met yet',

    // For parents
    forParents: 'For Parents',
    gateTitle: 'Ask a grown-up',
    gateInstruction: 'Type these numbers',
    gateWrong: 'Not quite. Try again.',
    cancel: 'Cancel',
    close: 'Close',
    soundLabel: 'Sound',
    on: 'On',
    off: 'Off',
    playLimitLabel: 'Daily play limit',
    noLimit: 'No limit',
    minutesShort: '{count} min',
    aboutTitle: 'About this app',
    promiseNoAds: 'No advertising',
    promiseNoAccounts: 'No accounts or sign-in',
    promiseNoPurchases: 'No purchases',
    promiseNoLinks: 'No links out of the app',
    promiseNoData: 'No personal information collected',
    versionLabel: 'Version {version}',

    // Play time
    timeUpTitle: 'Play time is over',
    timeUpSubtitle: 'The animals are going to sleep. See you next time!',
    timeUpGrownUp: 'Grown-ups, tap here',
    moreTime: 'More time',

    // Guess the Animal encouragement (replaces the old game-over state)
    tryOnceMore: 'Try again!',
    listenAgain: 'Listen again',
    hereItIs: 'Here it is!',

    // Accessibility labels
    a11yBackButton: 'Go back to the previous screen',
    a11yMainMenuButton: 'Go to the main menu',
    a11yResetButton: 'Start this level again',
    a11yLanguageToggle: 'Switch language to Spanish',
    a11yOpenMenu: 'Open the menu',
    a11yPlaySound: 'Play the animal sound',
    a11yLevelStatus: 'Level {level} of {max}',
    a11yMovesStatus: '{moves} moves so far',
    a11yAnimalCard: '{animal}. Tap to hear its sound',
    a11yAnswerOption: '{animal}. Tap if this animal makes the sound',
    a11yMemoryCard: 'Hidden card {number}. Tap to turn it over',
    a11yMemoryCardRevealed: '{animal}. Already turned over',
    a11yModeCard: '{title}. {description}',
    a11yOpenAlbum: 'Open the animal album',
    a11yAlbumAnimal: '{animal}. You have met this animal',
    a11yAlbumLocked: 'An animal you have not met yet',
    a11yForParents: 'For parents. Opens a section for grown-ups',
    a11yGateDigit: 'Type the number {number}',
    a11yGateDelete: 'Delete the last number',
    a11ySoundToggle: 'Turn the sound {state}',
    a11yPlayLimit: 'Set the play time limit to {label}',
  },

  es: {
    // Menú principal
    appTitle: 'Aventuras de Animales',
    chooseAdventure: '¡Elige tu aventura!',
    modeLearnTitle: 'Aprende Sonidos y Nombres',
    modeLearnDescription: 'Descubre animales y sus sonidos',
    modeGuessTitle: 'Adivina el Animal',
    modeGuessDescription: '¡Pon a prueba tu conocimiento!',
    modeMemoryTitle: 'Entrena tu Memoria',
    modeMemoryDescription: '¡Encuentra parejas de animales!',

    // Navegación común
    back: 'Atrás',
    mainMenu: 'Menú',
    mainMenuFull: 'Menú Principal',
    reset: 'Reiniciar',
    level: 'Nivel',

    // Adivina el Animal
    playSound: 'Reproducir Sonido',
    whichAnimal: '¿Qué animal hace este sonido?',
    amazing: '¡Increíble!',
    finishedAllLevels: '¡Terminaste todos los niveles!',
    restart: 'Reiniciar',
    gameOver: 'Juego Terminado',
    tryAgain: 'Intentar de Nuevo',

    // Juego de memoria
    memoryGame: 'Juego de Memoria',
    moves: 'Movimientos',
    findPairs: '¡Encuentra parejas de animales! ({count} cartas)',
    levelComplete: '¡Nivel Completado!',
    movingToLevel: 'Pasando al nivel {level}...',
    completedAllMemoryLevels: '¡Completaste todos los niveles de memoria!',
    playAgain: 'Jugar de Nuevo',

    // Álbum de animales
    albumTitle: 'Álbum de Animales',
    albumDescription: '¡Mira todos los animales que has conocido!',
    albumProgress: '{met} de {total} animales conocidos',
    albumHintEmpty: '¡Juega para empezar a conocer animales!',
    notMetYet: 'Aún no lo conoces',

    // Para padres
    forParents: 'Para Padres',
    gateTitle: 'Pide ayuda a un adulto',
    gateInstruction: 'Escribe estos números',
    gateWrong: 'Casi. Inténtalo otra vez.',
    cancel: 'Cancelar',
    close: 'Cerrar',
    soundLabel: 'Sonido',
    on: 'Activado',
    off: 'Desactivado',
    playLimitLabel: 'Límite diario',
    noLimit: 'Sin límite',
    minutesShort: '{count} min',
    aboutTitle: 'Sobre esta app',
    promiseNoAds: 'Sin publicidad',
    promiseNoAccounts: 'Sin cuentas ni registro',
    promiseNoPurchases: 'Sin compras',
    promiseNoLinks: 'Sin enlaces que salgan de la app',
    promiseNoData: 'No recopilamos información personal',
    versionLabel: 'Versión {version}',

    // Tiempo de juego
    timeUpTitle: 'Se acabó el tiempo de juego',
    timeUpSubtitle: 'Los animales se van a dormir. ¡Hasta la próxima!',
    timeUpGrownUp: 'Adultos, toquen aquí',
    moreTime: 'Más tiempo',

    // Ánimo en Adivina el Animal (sustituye el antiguo fin de juego)
    tryOnceMore: '¡Inténtalo otra vez!',
    listenAgain: 'Escucha de nuevo',
    hereItIs: '¡Aquí está!',

    // Etiquetas de accesibilidad
    a11yBackButton: 'Volver a la pantalla anterior',
    a11yMainMenuButton: 'Ir al menú principal',
    a11yResetButton: 'Comenzar este nivel de nuevo',
    a11yLanguageToggle: 'Cambiar el idioma a inglés',
    a11yOpenMenu: 'Abrir el menú',
    a11yPlaySound: 'Reproducir el sonido del animal',
    a11yLevelStatus: 'Nivel {level} de {max}',
    a11yMovesStatus: '{moves} movimientos hasta ahora',
    a11yAnimalCard: '{animal}. Toca para escuchar su sonido',
    a11yAnswerOption: '{animal}. Toca si este animal hace el sonido',
    a11yMemoryCard: 'Carta oculta {number}. Toca para darle la vuelta',
    a11yMemoryCardRevealed: '{animal}. Ya está descubierta',
    a11yModeCard: '{title}. {description}',
    a11yOpenAlbum: 'Abrir el álbum de animales',
    a11yAlbumAnimal: '{animal}. Ya conoces este animal',
    a11yAlbumLocked: 'Un animal que aún no conoces',
    a11yForParents: 'Para padres. Abre una sección para adultos',
    a11yGateDigit: 'Escribe el número {number}',
    a11yGateDelete: 'Borrar el último número',
    a11ySoundToggle: 'Poner el sonido en {state}',
    a11yPlayLimit: 'Poner el límite de tiempo en {label}',
  },
};

/**
 * Digits written as words, per language.
 *
 * The parental gate shows a number in words and asks for it back in digits.
 * That is deliberately a reading task rather than an arithmetic one: a child
 * too young for this app cannot read "four", while any adult can.
 */
export const NUMBER_WORDS = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'],
};

export const DEFAULT_LANGUAGE = 'en';

/**
 * Look up a UI string.
 *
 * Falls back to English, then to the key itself, so a missing translation
 * degrades to readable text instead of rendering "undefined".
 *
 * @param {string} lang    Language code, e.g. 'en' or 'es'.
 * @param {string} key     Key from STRINGS.
 * @param {object} [params] Values for {placeholders} in the string.
 */
export function t(lang, key, params) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANGUAGE];
  let value = table[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;

  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }

  return value;
}
