import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Image,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { t, MIN_TOUCH_TARGET, LARGE_TOUCH_TARGET } from '../../constants';
import { tapFeedback, selectFeedback } from '../../utils/haptics';

const ICON_SIZE = { width: 90, height: 90 };
const ICON_SIZE_LANDSCAPE = { width: 60, height: 60 };

// The three cards differ only by icon and copy, so they are described once
// here and rendered in a loop. Keeps their accessibility wiring identical.
const MODES = [
  {
    key: 'learn',
    icon: require('../../assets/animations/icons/learn_icon.json'),
    titleKey: 'modeLearnTitle',
    descriptionKey: 'modeLearnDescription',
  },
  {
    key: 'guess',
    icon: require('../../assets/animations/icons/guess_icon.json'),
    titleKey: 'modeGuessTitle',
    descriptionKey: 'modeGuessDescription',
  },
  {
    key: 'memory',
    icon: require('../../assets/animations/icons/memory_icon.json'),
    titleKey: 'modeMemoryTitle',
    descriptionKey: 'modeMemoryDescription',
  },
];

function MainMenu({ onModeSelect, currentLanguage, setCurrentLanguage }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  // Stacked full-width cards give one card per screen on a landscape tablet,
  // which Android 16 can force regardless of the manifest. Side by side keeps
  // all three adventures reachable without scrolling.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // The launch splash now lives in App, so this screen just fades itself in.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onLanguageToggle = () => {
    tapFeedback();
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };

  const handleModeSelect = mode => {
    selectFeedback();
    onModeSelect(mode);
  };

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        {/* Header with Logo and Language Selector */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo/logoEliLearn.png')}
            style={styles.logo}
            accessible={false}
            accessibilityRole="image"
          />
          <TouchableOpacity
            style={styles.languageToggle}
            onPress={onLanguageToggle}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yLanguageToggle')}
          >
            <MaterialIcons name="translate" size={28} color="white" />
            <Text style={styles.languageText}>
              {currentLanguage.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              isLandscape && styles.contentLandscape,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.title,
                isLandscape && styles.titleLandscape,
                fontsLoaded && { fontFamily: 'Bangers_400Regular' },
              ]}
            >
              {t(currentLanguage, 'appTitle')}
            </Text>

            <Text style={[styles.subtitle, isLandscape && styles.subtitleLandscape]}>
              {t(currentLanguage, 'chooseAdventure')}
            </Text>

            {/* Mode Selection Buttons */}
            <View
              style={[
                styles.modeContainer,
                isLandscape && styles.modeContainerLandscape,
              ]}
            >
              <AmbientBackground />
              {MODES.map(mode => {
                const title = t(currentLanguage, mode.titleKey);
                const description = t(currentLanguage, mode.descriptionKey);

                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[
                      styles.modeButton,
                      isLandscape && styles.modeButtonLandscape,
                    ]}
                    onPress={() => handleModeSelect(mode.key)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t(currentLanguage, 'a11yModeCard', {
                      title,
                      description,
                    })}
                  >
                    <View
                      style={[
                        styles.modeIconContainer,
                        isLandscape && styles.modeIconContainerLandscape,
                      ]}
                    >
                      <LottieView
                        source={mode.icon}
                        autoPlay
                        loop
                        resizeMode="contain"
                        style={isLandscape ? ICON_SIZE_LANDSCAPE : ICON_SIZE}
                        autoSize={false}
                      />
                    </View>
                    <Text
                      style={[
                        styles.modeTitle,
                        isLandscape && styles.modeTitleLandscape,
                        fontsLoaded && { fontFamily: 'Bangers_400Regular' },
                      ]}
                    >
                      {title}
                    </Text>
                    <Text style={styles.modeDescription}>{description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  logo: {
    width: 120,
    height: 50,
    resizeMode: 'contain',
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: LARGE_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  languageText: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 24,
  },
  contentLandscape: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  contentWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 6,
  },
  titleLandscape: {
    fontSize: 30,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 22,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: '600',
  },
  subtitleLandscape: {
    fontSize: 17,
    marginBottom: 14,
  },
  modeContainer: {
    width: '100%',
    gap: 30,
  },
  modeContainerLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  modeButton: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  modeButtonLandscape: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  modeIconContainer: {
    marginBottom: 15,
  },
  modeIconContainerLandscape: {
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  // Only the heading shrinks in landscape; the description stays at the
  // MIN_FONT_SIZE floor set for young readers.
  modeTitleLandscape: {
    fontSize: 20,
    marginBottom: 6,
  },
  modeDescription: {
    fontSize: 18,
    color: '#5A5A5A',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MainMenu;


