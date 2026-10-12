/**
 * Utility functions for the Animal Adventures app
 */

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
export const capitalizeFirst = str => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Format animal name for display
 * @param {string} animalName - The raw animal name
 * @returns {string} The formatted animal name
 */
export const formatAnimalName = animalName => {
  if (!animalName) return '';

  // Handle special cases
  const specialCases = {
    'piggy-bank': 'Piggy Bank',
    'fitness-cow': 'Fitness Cow',
    'sleeping-polar-bear': 'Sleeping Polar Bear',
    'sleepy-cat': 'Sleepy Cat',
    'wolf-howling': 'Wolf Howling',
    'butterfly-lottie': 'Butterfly',
  };

  if (specialCases[animalName]) {
    return specialCases[animalName];
  }

  // Handle general cases
  return animalName
    .split('-')
    .map(word => capitalizeFirst(word))
    .join(' ');
};

/**
 * Get file extension from filename
 * @param {string} filename - The filename
 * @returns {string} The file extension
 */
export const getFileExtension = filename => {
  if (!filename) return '';
  return filename.split('.').pop().toLowerCase();
};

/**
 * Check if a file is an audio file
 * @param {string} filename - The filename to check
 * @returns {boolean} True if it's an audio file
 */
export const isAudioFile = filename => {
  const audioExtensions = ['mp3', 'wav', 'aac', 'm4a'];
  const extension = getFileExtension(filename);
  return audioExtensions.includes(extension);
};

/**
 * Check if a file is an image file
 * @param {string} filename - The filename to check
 * @returns {boolean} True if it's an image file
 */
export const isImageFile = filename => {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  const extension = getFileExtension(filename);
  return imageExtensions.includes(extension);
};

/**
 * Strip accents, e.g. so "Águila" compares equal to "Aguila".
 * @param {string} str
 * @returns {string}
 */
export const stripAccents = str => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * The letter an animal's name starts with, in the given language.
 * Accents are stripped first so "Águila" counts as starting with A, the
 * same letter a child hears regardless of the written accent mark.
 * @param {{name: string, spanish_name: string}} animal
 * @param {'en'|'es'} lang
 * @returns {string} A single uppercase letter.
 */
export const firstLetterOf = (animal, lang) => {
  const name = lang === 'en' ? animal.name : animal.spanish_name;
  return stripAccents(name).trim().charAt(0).toUpperCase();
};

/**
 * Debounce function to limit function calls
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} The debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function to limit function calls
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} The throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export default {
  capitalizeFirst,
  formatAnimalName,
  getFileExtension,
  isAudioFile,
  isImageFile,
  stripAccents,
  firstLetterOf,
  debounce,
  throttle,
};
