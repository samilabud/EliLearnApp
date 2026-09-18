import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MySplashScreen } from './components/utility/my-splash-screen.component';
import MainMenu from './components/main_menu/main_menu.component.jsx';
import HomeScreen from './components/home/home.component.js';
import GuessAnimalGame from './components/games/guess-animal.game.component.jsx';
import MemoryAnimalGame from './components/games/memory-animal.game.component.jsx';
import {
  GameProgressProvider,
  useGameProgress,
} from './contexts/game-progress.context';
import { EVENTS, initAnalytics, track } from './utils/analytics';

// Long enough for the logo animation and its jingle to finish.
const SPLASH_DURATION_MS = 4000;

function AppContent() {
  const [currentMode, setCurrentMode] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [showSplash, setShowSplash] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const { hydrated } = useGameProgress();

  // The intro belongs to app launch, not to any one screen. It used to be
  // mounted inside both the menu and the learn screen, so switching modes
  // unmounted and remounted it - replaying the animation and the jingle, and
  // costing four seconds on every single navigation.
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

  const handleLanguageChange = useCallback(next => {
    track(EVENTS.LANGUAGE_CHANGED, { to: next });
    setCurrentLanguage(next);
  }, []);

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
  if (showSplash || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#BD0000' }}>
        <MySplashScreen />
        <StatusBar style="auto" />
      </View>
    );
  }

  let content;
  if (!currentMode) {
    content = (
      <MainMenu
        onModeSelect={handleModeSelect}
        currentLanguage={currentLanguage}
        setCurrentLanguage={handleLanguageChange}
      />
    );
  } else if (currentMode === 'learn') {
    content = (
      <HomeScreen
        currentLanguage={currentLanguage}
        onBackToMenu={handleBackToMenu}
      />
    );
  } else if (currentMode === 'guess') {
    content = (
      <GuessAnimalGame
        currentLanguage={currentLanguage}
        onBackToMenu={handleBackToMenu}
      />
    );
  } else if (currentMode === 'memory') {
    content = (
      <MemoryAnimalGame
        currentLanguage={currentLanguage}
        onBackToMenu={handleBackToMenu}
      />
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>{content}</Animated.View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProgressProvider>
        <AppContent />
      </GameProgressProvider>
    </SafeAreaProvider>
  );
}
