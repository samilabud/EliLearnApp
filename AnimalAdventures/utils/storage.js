/**
 * Durable key-value storage.
 *
 * Everything here fails soft. A corrupted or unavailable store must never
 * crash the app or block a child from playing - the worst acceptable outcome
 * is starting a level over, which is exactly what the app did before any of
 * this existed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const NAMESPACE = 'animaladventures';

const namespaced = name => `${NAMESPACE}:${name}`;

/**
 * Read and parse a stored JSON value.
 * @param {string} name - Key name, without the namespace prefix.
 * @param {*} fallback - Returned when the key is absent or unreadable.
 * @returns {Promise<*>} The parsed value, or `fallback`.
 */
export const loadJSON = async (name, fallback = null) => {
  try {
    const raw = await AsyncStorage.getItem(namespaced(name));
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

/**
 * Serialize and store a JSON value.
 * @param {string} name - Key name, without the namespace prefix.
 * @param {*} value - Any JSON-serializable value.
 * @returns {Promise<boolean>} True when the write landed.
 */
export const saveJSON = async (name, value) => {
  try {
    await AsyncStorage.setItem(namespaced(name), JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Delete a stored key.
 * @param {string} name - Key name, without the namespace prefix.
 * @returns {Promise<boolean>} True when the delete landed.
 */
export const removeKey = async name => {
  try {
    await AsyncStorage.removeItem(namespaced(name));
    return true;
  } catch (e) {
    return false;
  }
};
