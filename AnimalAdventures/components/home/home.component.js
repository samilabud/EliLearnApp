import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ImageBackground,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimalScreen from '../animals/animal.screen.component.jsx';
import { MaterialIcons } from '@expo/vector-icons';
import { AmbientBackground } from '../utility/ambient-background.component';
import { t, MIN_TOUCH_TARGET, LARGE_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';

const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

function HomeScreen({ currentLanguage, setCurrentLanguage, onBackToMenu }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    tapFeedback();
    onBackToMenu();
  };

  const onLanguageToggle = () => {
    tapFeedback();
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };

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
      <AmbientBackground />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.languageToggle}
              onPress={onLanguageToggle}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yLanguageToggle')}
            >
              <MaterialIcons name="translate" size={20} color="white" />
              <Text style={styles.languageText}>
                {currentLanguage.toUpperCase()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleBack}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <Text style={styles.actionText}>
                {t(currentLanguage, 'mainMenu')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <AnimalScreen currentLanguage={currentLanguage} />
      </Animated.View>
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
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: LARGE_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  languageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});

export default HomeScreen;
