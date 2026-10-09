/**
 * The games a child can play, in the order they appear on the main menu.
 * The album is left out - it has no levels or an end screen, so it isn't
 * something to cycle through, just something to browse.
 *
 * This is the sequence the "Next Game" button steps through from any game
 * screen, wrapping back to the start after the last one.
 */
export const GAME_ORDER = ['learn', 'guess', 'letter', 'trace', 'memory'];
