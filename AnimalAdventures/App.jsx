import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MySplashScreen } from './components/utility/my-splash-screen.component';
import MainMenu from './components/main_menu/main_menu.component.jsx';
import HomeScreen from './components/home/home.component.js';
import GuessAnimalGame from './components/games/guess-animal.game.component.jsx';
import MemoryAnimalGame from './components/games/memory-animal.game.component.jsx';
import AlbumScreen from './components/collection/album.screen.component.jsx';
import ParentalGate from './components/parents/parental-gate.component.jsx';
import ParentArea from './components/parents/parent-area.component.jsx';
import PlayTimeUp from './components/utility/play-time-up.component.jsx';
import {
  GameProgressProvider,
  useGameProgress,
} from './contexts/game-progress.context';
import { SettingsProvider, useSettings } from './contexts/settings.context';
import { EVENTS, initAnalytics, track } from './utils/analytics';

// Long enough for the logo animation and its jingle to finish - but a child
// waiting to hear a dog bark should not have to sit through it every time,
// so a tap skips it.
const SPLASH_DURATION_MS = 4000;

function AppContent() {
  const [currentMode, setCurrentMode] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [gateVisible, setGateVisible] = useState(false);
  const [parentAreaVisible, setParentAreaVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const { hydrated: progressReady } = useGameProgress();
  const {
    hydrated: settingsReady,
    language,
    setLanguage,
    timeUp,
    grantMoreTime,
  } = useSettings();

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    initAnalytics();
  }, []);

  const handleModeSelect = mode => {
    track(EVENTS.MODE_SELECTED, { mode });
    setCurrentMode(mode);
  };

  const handleBackToMenu = () => {
    setCurrentMode(null);
  };

  const handleLanguageChange = useCallback(
    next => {
      track(EVENTS.LANGUAGE_CHANGED, { to: next });
      setLanguage(next);
    },
    [setLanguage]
  );

  useEffect(() => {
    if (showSplash) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [currentMode, fade, showSplash]);

  // Holding the splash until storage has been read keeps a game from mounting
  // with a blank board and dealing a fresh one over the child's saved level.
  // Reading finishes far inside the splash window, so this costs nothing.
  const ready = progressReady && settingsReady;

  if (showSplash || !ready) {
    return (
      <Pressable
        style={{ flex: 1, backgroundColor: '#BD0000' }}
        onPress={() => ready && setShowSplash(false)}
        accessible={false}
      >
        <MySplashScreen />
        <StatusBar style="auto" />
      </Pressable>
    );
  }

  // The daily allowance replaces the whole app rather than overlaying it, so
  // there is nothing left to tap around.
  if (timeUp) {
    return (
      <>
        <PlayTimeUp currentLanguage={language} onMoreTime={grantMoreTime} />
        <StatusBar style="light" />
      </>
    );
  }

  let content;
  if (!currentMode) {
    content = (
      <MainMenu
        onModeSelect={handleModeSelect}
        currentLanguage={language}
        setCurrentLanguage={handleLanguageChange}
        onOpenParents={() => setGateVisible(true)}
      />
    );
  } else if (currentMode === 'learn') {
    content = (
      <HomeScreen currentLanguage={language} onBackToMenu={handleBackToMenu} />
    );
  } else if (currentMode === 'guess') {
    content = (
      <GuessAnimalGame
        currentLanguage={language}
        onBackToMenu={handleBackToMenu}
      />
    );
  } else if (currentMode === 'memory') {
    content = (
      <MemoryAnimalGame
        currentLanguage={language}
        onBackToMenu={handleBackToMenu}
      />
    );
  } else if (currentMode === 'album') {
    content = (
      <AlbumScreen currentLanguage={language} onBackToMenu={handleBackToMenu} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {content}
      </Animated.View>

      <ParentalGate
        visible={gateVisible}
        currentLanguage={language}
        onPass={() => {
          setGateVisible(false);
          setParentAreaVisible(true);
        }}
        onCancel={() => setGateVisible(false)}
      />

      <ParentArea
        visible={parentAreaVisible}
        currentLanguage={language}
        onClose={() => setParentAreaVisible(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <GameProgressProvider>
          <AppContent />
        </GameProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
