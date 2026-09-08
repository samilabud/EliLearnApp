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
  },
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
