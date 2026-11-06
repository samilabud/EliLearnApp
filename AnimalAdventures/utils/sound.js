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
let voiceEnabled = true;
let voiceRate = 1;

/**
 * Turn sound effects (animal noises, jingles, the wrong-answer chirp) on or
 * off. Called by the settings context.
 * @param {boolean} value
 */
export const setSoundEnabled = value => {
  enabled = value !== false;
};

/** @returns {boolean} Whether sound effects are currently allowed. */
export const isSoundEnabled = () => enabled;

/**
 * Turn spoken audio (instructions, animal names, letters, numbers) on or
 * off - separately from effects, so a parent can keep the words and drop
 * the noise, or the other way round.
 * @param {boolean} value
 */
export const setVoiceEnabled = value => {
  voiceEnabled = value !== false;
};

/** @returns {boolean} Whether spoken audio is currently allowed. */
export const isVoiceEnabled = () => voiceEnabled;

/**
 * Playback speed for spoken audio: 1 is normal, below 1 slower for a child
 * still learning the words. Pitch is corrected so it doesn't sound deeper.
 * @param {number} rate
 */
export const setVoiceRate = rate => {
  voiceRate = rate > 0 ? rate : 1;
};

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
 * Play a spoken clip (instruction, name, letter, number) through an
 * existing player, honoring the voice toggle and speed.
 * @param {object} player - Player from `useAudioPlayer`.
 * @param {*} [source] - Module returned by `require()`; omit to replay.
 */
export const playVoice = (player, source) => {
  if (!voiceEnabled || !player) return;
  try {
    if (source) player.replace(source);
    player.setPlaybackRate?.(voiceRate, 'high');
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
