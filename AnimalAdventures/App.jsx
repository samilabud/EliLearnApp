import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import MainMenu from './components/main_menu/main_menu.component.jsx';
import HomeScreen from './components/home/home.component.js';

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

  const content = !currentMode ? (
    <MainMenu
      onModeSelect={handleModeSelect}
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
    />
  ) : (
    <HomeScreen
      currentLanguage={currentLanguage}
      onBackToMenu={handleBackToMenu}
    />
  );

  return <Animated.View style={{ flex: 1, opacity: fade }}>{content}</Animated.View>;
}


