/**
 * Parent-controlled settings and the daily play allowance.
 *
 * Everything here is a choice a grown-up made, so all of it is persisted -
 * including language, which previously lived in component state and reset to
 * English on every launch. A Spanish-speaking family had to re-tap the
 * toggle every single time they opened the app.
 *
 * The play allowance is tracked per calendar day rather than per session, so
 * closing and reopening the app does not hand back more time.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { loadJSON, saveJSON } from '../utils/storage';
import { setSoundEnabled } from '../utils/sound';

const SETTINGS_KEY = 'app.settings';
const USAGE_KEY = 'app.usage';

/** How often play time is counted and written down. */
const TICK_MS = 10000;

/** Options offered in the parent area, in minutes. 0 means no limit. */
export const PLAY_LIMIT_OPTIONS = [0, 10, 15, 20, 30, 45];

const DEFAULT_SETTINGS = {
  language: 'en',
  soundEnabled: true,
  playLimitMinutes: 0,
};

const SettingsContext = createContext(null);

/** Local calendar day, which is the boundary a parent thinks in. */
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function SettingsProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const usageDay = useRef(today());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadJSON(SETTINGS_KEY, null);
      const usage = await loadJSON(USAGE_KEY, null);
      if (cancelled) return;

      const next = stored
        ? { ...DEFAULT_SETTINGS, ...stored }
        : DEFAULT_SETTINGS;
      setSettings(next);
      setSoundEnabled(next.soundEnabled);

      // Yesterday's usage is not today's problem.
      if (usage && usage.day === today()) {
        setUsedSeconds(usage.usedSeconds || 0);
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(patch => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveJSON(SETTINGS_KEY, next);
      if ('soundEnabled' in patch) setSoundEnabled(next.soundEnabled);
      return next;
    });
  }, []);

  const limitSeconds = settings.playLimitMinutes * 60;
  const timeUp = limitSeconds > 0 && usedSeconds >= limitSeconds;

  // Only count time the app is actually in front of the child, and stop
  // counting once the limit is reached so the overdraft cannot grow.
  useEffect(() => {
    if (!hydrated || limitSeconds === 0 || timeUp) return;

    const tick = () => {
      if (AppState.currentState !== 'active') return;
      const day = today();
      if (day !== usageDay.current) {
        usageDay.current = day;
        setUsedSeconds(0);
        saveJSON(USAGE_KEY, { day, usedSeconds: 0 });
        return;
      }
      setUsedSeconds(prev => {
        const next = prev + TICK_MS / 1000;
        saveJSON(USAGE_KEY, { day, usedSeconds: next });
        return next;
      });
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [hydrated, limitSeconds, timeUp]);

  /**
   * Hand back another slice of time. Reachable only from behind the parental
   * gate, which is the whole point of the limit.
   * @param {number} minutes
   */
  const grantMoreTime = useCallback(minutes => {
    setUsedSeconds(prev => {
      const next = Math.max(0, prev - minutes * 60);
      saveJSON(USAGE_KEY, { day: today(), usedSeconds: next });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      language: settings.language,
      soundEnabled: settings.soundEnabled,
      playLimitMinutes: settings.playLimitMinutes,
      setLanguage: language => update({ language }),
      setSoundEnabled: soundEnabled => update({ soundEnabled }),
      setPlayLimitMinutes: playLimitMinutes => update({ playLimitMinutes }),
      timeUp,
      minutesRemaining:
        limitSeconds > 0
          ? Math.max(0, Math.ceil((limitSeconds - usedSeconds) / 60))
          : null,
      grantMoreTime,
    }),
    [
      hydrated,
      settings,
      timeUp,
      limitSeconds,
      usedSeconds,
      update,
      grantMoreTime,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Read and change parent-controlled settings.
 * @returns {object} Settings, setters, and play-time state.
 */
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
