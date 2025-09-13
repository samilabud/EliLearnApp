import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import MainMenu from './components/main_menu/main_menu.component.jsx';
import HomeScreen from './components/home/home.component.js';
import GuessAnimalGame from './components/games/guess-animal.game.component.jsx';
import MemoryAnimalGame from './components/games/memory-animal.game.component.jsx';

export default function App() {
  const [currentMode, setCurrentMode] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const fade = useRef(new Animated.Value(0)).current;

  const handleModeSelect = mode => {
    setCurrentMode(mode);
  };

  const handleBackToMenu = () => {
    setCurrentMode(null);
  };

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [currentMode, fade]);

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
    <Animated.View style={{ flex: 1, opacity: fade }}>{content}</Animated.View>
  );
}


