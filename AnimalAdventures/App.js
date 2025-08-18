import React, { useState } from 'react';
import MainMenu from './components/main_menu/main_menu.component';
import HomeScreen from './components/home/home.component';

export default function App() {
  const [currentMode, setCurrentMode] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const handleModeSelect = mode => {
    setCurrentMode(mode);
  };

  const handleBackToMenu = () => {
    setCurrentMode(null);
  };

  // Show main menu if no mode is selected
  if (!currentMode) {
    return (
      <MainMenu
        onModeSelect={handleModeSelect}
        currentLanguage={currentLanguage}
        setCurrentLanguage={setCurrentLanguage}
      />
    );
  }

  // Show learning mode
  if (currentMode === 'learn') {
    return (
      <HomeScreen
        currentLanguage={currentLanguage}
        onBackToMenu={handleBackToMenu}
      />
    );
  }

  // Fallback to main menu
  return (
    <MainMenu
      onModeSelect={handleModeSelect}
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
    />
  );
}
