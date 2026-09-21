/**
 * Mute-aware playback.
 *
 * Every animal sound, spoken name and jingle in the app goes through here so
 * that muting is one flag rather than a setting each screen has to remember
 * to check. The flag is module level rather than React state because sounds
 * are triggered from callbacks and timers that do not re-render when a
 * setting changes.
 *
 * Failures are swallowed on purpose: a sound that will not load must never
 * interrupt a child mid-game.
 */

let enabled = true;

/**
 * Turn all playback on or off. Called by the settings context.
 * @param {boolean} value
 */
export const setSoundEnabled = value => {
  enabled = value !== false;
};

/** @returns {boolean} Whether sound is currently allowed. */
export const isSoundEnabled = () => enabled;

/**
 * Play a clip through an existing expo-audio player.
 * @param {object} player - Player from `useAudioPlayer`.
 * @param {*} [source] - Module returned by `require()`; omit to replay.
 */
export const playClip = (player, source) => {
  if (!enabled || !player) return;
  try {
    if (source) player.replace(source);
    player.play();
  } catch {
    // A missing or busy player is not worth interrupting play for.
  }
};

/**
 * Stop a player and rewind it.
 * @param {object} player - Player from `useAudioPlayer`.
 */
export const stopClip = player => {
  if (!player) return;
  try {
    player.pause();
    player.seekTo(0);
  } catch {
    // Already stopped or removed.
  }
};

/**
 * Release a player. Safe to call on an already-removed player.
 * @param {object} player - Player from `useAudioPlayer`.
 */
export const releasePlayer = player => {
  try {
    player.remove();
  } catch {
    // Already released.
  }
};
