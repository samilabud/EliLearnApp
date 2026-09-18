/**
 * Analytics for a children's app.
 *
 * PRIVACY CONTRACT - read before adding anything here.
 *
 * This app's audience is young children, which puts it under Google Play's
 * Families policy and COPPA. Those rules forbid collecting persistent
 * identifiers for advertising from children, so this module deliberately
 * records NO device identifiers, NO advertising ID, NO IP-linked data and NO
 * free text a child or parent could type. The only identifier is `installId`:
 * a random value generated on-device that never leaves it unless you wire up
 * a sink, and which exists purely so returning sessions can be counted.
 *
 * Nothing is transmitted anywhere by default. Events accumulate locally and
 * are handed to whatever `setSink` is given. Wiring a real provider is a
 * product decision with disclosure consequences - see `setSink` below.
 */
import { loadJSON, saveJSON } from './storage';

const PROFILE_KEY = 'analytics.profile';
const EVENTS_KEY = 'analytics.events';

/** Most recent events kept on device. Old entries are dropped first. */
const MAX_BUFFERED_EVENTS = 200;

/** Distinct active days retained - enough to compute 30-day retention. */
const MAX_TRACKED_DAYS = 60;

/**
 * Event names. Centralized so call sites cannot drift into near-duplicate
 * spellings, which is the usual way an event taxonomy rots.
 */
export const EVENTS = {
  APP_OPEN: 'app_open',
  MODE_SELECTED: 'mode_selected',
  GAME_STARTED: 'game_started',
  LEVEL_COMPLETED: 'level_completed',
  GAME_COMPLETED: 'game_completed',
  GAME_OVER: 'game_over',
  GAME_ABANDONED: 'game_abandoned',
  GAME_RESET: 'game_reset',
  GAME_RESUMED: 'game_resumed',
  ANIMAL_VIEWED: 'animal_viewed',
  LANGUAGE_CHANGED: 'language_changed',
};

const EMPTY_PROFILE = {
  version: 1,
  installId: null,
  installedAt: null,
  sessionCount: 0,
  lastSeenAt: null,
  activeDays: [],
  modeCounts: {},
  maxLevel: {},
};

let profile = { ...EMPTY_PROFILE };
let buffer = [];
let sessionStartedAt = null;
let ready = false;
let sink = null;

/** YYYY-MM-DD in local time, which is the day boundary a parent perceives. */
const today = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Anonymous, non-cryptographic install token. Math.random is fine here: this
 * labels a local counter, it never authenticates or secures anything.
 */
const newInstallId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const persistProfile = () => {
  saveJSON(PROFILE_KEY, profile);
};

const persistBuffer = () => {
  saveJSON(EVENTS_KEY, buffer);
};

/**
 * Register a destination for events.
 *
 * Leave this unset to keep every measurement on the device. Connecting a
 * remote provider means the app transmits child-associated usage data, which
 * requires updating the Play Data safety form and, depending on the provider,
 * a Families-certified SDK. Do not wire one in casually.
 *
 * @param {(name: string, props: object) => void} fn - Receives each event.
 */
export const setSink = fn => {
  sink = typeof fn === 'function' ? fn : null;
};

/**
 * Hydrate stored counters and open a session. Safe to call more than once;
 * only the first call starts a session.
 * @returns {Promise<void>}
 */
export const initAnalytics = async () => {
  if (ready) return;
  ready = true;

  try {
    const stored = await loadJSON(PROFILE_KEY, null);
    profile = stored ? { ...EMPTY_PROFILE, ...stored } : { ...EMPTY_PROFILE };
    buffer = (await loadJSON(EVENTS_KEY, [])) || [];
  } catch (e) {
    profile = { ...EMPTY_PROFILE };
    buffer = [];
  }

  const now = new Date().toISOString();
  const isFirstRun = !profile.installId;
  if (isFirstRun) {
    profile.installId = newInstallId();
    profile.installedAt = now;
  }

  const day = today();
  if (!profile.activeDays.includes(day)) {
    profile.activeDays = [...profile.activeDays, day].slice(-MAX_TRACKED_DAYS);
  }
  profile.sessionCount += 1;
  profile.lastSeenAt = now;
  sessionStartedAt = Date.now();
  persistProfile();

  track(EVENTS.APP_OPEN, {
    session_number: profile.sessionCount,
    days_since_install: daysSinceInstall(),
    first_run: isFirstRun,
  });
};

/**
 * Whole days between install and now. This is the axis retention is measured
 * on, so it is computed once here rather than at each call site.
 * @returns {number}
 */
export const daysSinceInstall = () => {
  if (!profile.installedAt) return 0;
  const ms = Date.now() - new Date(profile.installedAt).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

/**
 * Record an event. Fire-and-forget: never awaited, never throws, never blocks
 * a tap. A failure to measure must not become a failure to play.
 * @param {string} name - One of `EVENTS`.
 * @param {object} [props] - Non-identifying properties only.
 */
export const track = (name, props = {}) => {
  try {
    const event = {
      name,
      props,
      at: new Date().toISOString(),
      session: profile.sessionCount,
    };

    buffer = [...buffer, event].slice(-MAX_BUFFERED_EVENTS);
    persistBuffer();

    if (name === EVENTS.MODE_SELECTED && props.mode) {
      profile.modeCounts = {
        ...profile.modeCounts,
        [props.mode]: (profile.modeCounts[props.mode] || 0) + 1,
      };
      persistProfile();
    }

    if (name === EVENTS.LEVEL_COMPLETED && props.game && props.level) {
      const best = profile.maxLevel[props.game] || 0;
      if (props.level > best) {
        profile.maxLevel = { ...profile.maxLevel, [props.game]: props.level };
        persistProfile();
      }
    }

    if (sink) sink(name, event.props);
    if (__DEV__) console.log(`[analytics] ${name}`, props);
  } catch (e) {
    // Measurement is never worth an exception.
  }
};

/** Seconds elapsed in the current session. @returns {number} */
export const sessionDurationSec = () =>
  sessionStartedAt ? Math.round((Date.now() - sessionStartedAt) / 1000) : 0;

/**
 * Everything measured so far, for inspection during development.
 *
 * `activeDays` is the useful field: its length against `daysSinceInstall`
 * tells you whether children actually come back, which is the single number
 * that decides whether this app is worth monetizing.
 *
 * @returns {{profile: object, recentEvents: object[]}}
 */
export const getSummary = () => ({
  profile: { ...profile },
  recentEvents: [...buffer],
});
