import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MySplashScreen } from './components/utility/my-splash-screen.component';
import MainMenu from './components/main_menu/main_menu.component.jsx';
import HomeScreen from './components/home/home.component.js';
import GuessAnimalGame from './components/games/guess-animal.game.component.jsx';
import MemoryAnimalGame from './components/games/memory-animal.game.component.jsx';

// Long enough for the logo animation and its jingle to finish.
const SPLASH_DURATION_MS = 4000;

export default function App() {
  const [currentMode, setCurrentMode] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [showSplash, setShowSplash] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;

  // The intro belongs to app launch, not to any one screen. It used to be
  // mounted inside both the menu and the learn screen, so switching modes
  // unmounted and remounted it - replaying the animation and the jingle, and
  // costing four seconds on every single navigation.
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleModeSelect = mode => {
    setCurrentMode(mode);
  };

  const handleBackToMenu = () => {
    setCurrentMode(null);
  };

  useEffect(() => {
    if (showSplash) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [currentMode, fade, showSplash]);

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#BD0000' }}>
          <MySplashScreen />
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    );
  }

  let content;
  if (!currentMode) {
    content = (
      <MainMenu
        onModeSelect={handleModeSelect}
        currentLanguage={currentLanguage}
        setCurrentLanguage={setCurrentLanguage}
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
    <SafeAreaProvider>
      <Animated.View style={{ flex: 1, opacity: fade }}>{content}</Animated.View>
    </SafeAreaProvider>
  );
}


