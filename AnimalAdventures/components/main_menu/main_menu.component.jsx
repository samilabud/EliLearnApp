import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback, selectFeedback } from '../../utils/haptics';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';

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
  // No Lottie icon of its own yet, so it uses a glyph like the album card.
  {
    key: 'letter',
    glyph: 'sort-by-alpha',
    titleKey: 'modeLetterTitle',
    descriptionKey: 'modeLetterDescription',
  },
  // Also glyph-only for now - a pencil/gesture icon reads clearly as
  // "drawing" without a bespoke Lottie.
  {
    key: 'trace',
    glyph: 'gesture',
    titleKey: 'modeTraceTitle',
    descriptionKey: 'modeTraceDescription',
  },
  {
    key: 'memory',
    icon: require('../../assets/animations/icons/memory_icon.json'),
    titleKey: 'modeMemoryTitle',
    descriptionKey: 'modeMemoryDescription',
  },
  // The album ships no Lottie of its own, so it uses a glyph at the same size
  // as the other icons rather than borrowing an animal's animation.
  {
    key: 'album',
    glyph: 'collections-bookmark',
    titleKey: 'albumTitle',
    descriptionKey: 'albumDescription',
  },
];

function MainMenu({
  onModeSelect,
  currentLanguage,
  setCurrentLanguage,
  onOpenParents,
  ambientEnabled,
}) {
  const [fadeAnim] = React.useState(() => new Animated.Value(0));
  // Entrance scale for the title (bounces in) and the idle "breathe" loop
  // that keeps it feeling alive once settled - same pulse pattern used for
  // the prompt button in the games (see promptPulse in first-letter.game).
  const [titleScale] = React.useState(() => new Animated.Value(0.6));
  const [titleBreathe] = React.useState(() => new Animated.Value(0));
  const [subtitleSlide] = React.useState(() => new Animated.Value(20));
  // 'Guess the First Letter' and the album both fall back to a plain
  // MaterialIcons glyph (no Lottie of their own yet - see MODES above), so
  // without their own animation they'd sit dead next to the two cards that
  // already loop. A gentle rock gives them the same liveliness.
  const [glyphWiggle] = React.useState(() => new Animated.Value(0));
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  // Stacked full-width cards give one card per screen on a landscape tablet,
  // which Android 16 can force regardless of the manifest. Side by side keeps
  // all three adventures reachable without scrolling.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // The launch splash now lives in App, so this screen just fades itself in,
  // while the title bounces in and the subtitle slides up under it - a
  // livelier arrival for a screen a preschooler sees every launch.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    Animated.timing(subtitleSlide, {
      toValue: 0,
      duration: 350,
      delay: 150,
      useNativeDriver: true,
    }).start();

    Animated.spring(titleScale, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(titleBreathe, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(titleBreathe, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glyphWiggle, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glyphWiggle, {
          toValue: -1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glyphWiggle, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, titleScale, titleBreathe, subtitleSlide, glyphWiggle]);

  const handleModeSelect = mode => {
    selectFeedback();
    onModeSelect(mode);
  };

  const titleBreatheScale = titleBreathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const glyphRotate = glyphWiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header: just the language selector now - the title below already
          carries the branding, and a small logo read as a plain sticker on
          the matching red header. */}
      <View style={styles.header}>
        <LanguageToggleButton
          currentLanguage={currentLanguage}
          onToggle={setCurrentLanguage}
        />
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
          <Animated.View
            style={{
              transform: [
                { scale: Animated.multiply(titleScale, titleBreatheScale) },
              ],
            }}
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
          </Animated.View>

          <Animated.View
            style={{ transform: [{ translateY: subtitleSlide }] }}
          >
            <Text
              style={[
                styles.subtitle,
                isLandscape && styles.subtitleLandscape,
              ]}
            >
              {t(currentLanguage, 'chooseAdventure')}
            </Text>
          </Animated.View>

          {/* Mode Selection Buttons */}
          <View
            style={[
              styles.modeContainer,
              isLandscape && styles.modeContainerLandscape,
            ]}
          >
            {ambientEnabled && <AmbientBackground />}
            {MODES.map(mode => {
              const title = t(currentLanguage, mode.titleKey);
              const description = t(currentLanguage, mode.descriptionKey);

              return (
                <BouncyButton
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
                    {mode.glyph ? (
                      <Animated.View
                        style={{ transform: [{ rotate: glyphRotate }] }}
                      >
                        <MaterialIcons
                          name={mode.glyph}
                          size={isLandscape ? 54 : 78}
                          color="#BD0000"
                        />
                      </Animated.View>
                    ) : (
                      <LottieView
                        source={mode.icon}
                        autoPlay
                        loop
                        resizeMode="contain"
                        style={isLandscape ? ICON_SIZE_LANDSCAPE : ICON_SIZE}
                        autoSize={false}
                      />
                    )}
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
                </BouncyButton>
              );
            })}
          </View>

          {/* Deliberately small, plain and at the bottom: this is the one
                control on the screen that is not for the child. */}
          <BouncyButton
            style={styles.parentsButton}
            onPress={() => {
              tapFeedback();
              onOpenParents();
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yForParents')}
          >
            <MaterialIcons
              name="lock-outline"
              size={16}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.parentsText}>
              {t(currentLanguage, 'forParents')}
            </Text>
          </BouncyButton>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
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
    // Bangers clips on Android without both of these - see
    // first-letter.game.component.jsx for the full explanation.
    lineHeight: 54,
    includeFontPadding: false,
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
    lineHeight: 32,
    includeFontPadding: false,
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
  parentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 28,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
  },
  parentsText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modeDescription: {
    fontSize: 18,
    color: '#5A5A5A',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MainMenu;
