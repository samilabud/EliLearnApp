import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ImageBackground, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimalScreen from '../animals/animal.screen.component.jsx';
import { AmbientBackground } from '../utility/ambient-background.component';
import { tapFeedback } from '../../utils/haptics';
import { useBackToMenu } from '../../utils/navigation';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import { NextGameButton } from '../utility/next-game-button.component';
import { BackToMenuButton } from '../utility/back-to-menu-button.component';

const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

function HomeScreen({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  ambientEnabled,
}) {
  const [fadeAnim] = React.useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();

  const handleBackToMenu = () => {
    tapFeedback();
    onBackToMenu();
  };

  useBackToMenu(handleBackToMenu);

  // The launch splash now lives in App, so this screen just fades itself in.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.backgroundImage}
    >
      {ambientEnabled && <AmbientBackground />}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <NextGameButton
            currentLanguage={currentLanguage}
            onPress={onNextGame}
          />
          <LanguageToggleButton
            currentLanguage={currentLanguage}
            onToggle={setCurrentLanguage}
          />
        </View>

        <AnimalScreen currentLanguage={currentLanguage} />
      </Animated.View>

      <BackToMenuButton
        currentLanguage={currentLanguage}
        onPress={handleBackToMenu}
      />

      <StatusBar style="auto" />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#BD0000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});

export default HomeScreen;
