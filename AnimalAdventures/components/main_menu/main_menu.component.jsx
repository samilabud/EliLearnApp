import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
// Matches the source PNG's own 100:85 aspect ratio, so it isn't stretched.
const MASCOT_SIZE = { width: 110, height: 94 };
const MASCOT_SIZE_LANDSCAPE = { width: 64, height: 54 };

// The app's own dog sublogo mark as a mascot above the title - unlike the
// dog baked into the store icon artwork, it has no background and doesn't
// carry English text that can't switch to Spanish.
const DOG_MASCOT = require('../../assets/logo/appname-sublogo-cute-dog-1.png');

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
  scrollAnimationsEnabled,
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
  // which Android 16 can force regardless of the manifest. Side by side
  // instead, in a horizontally scrolling row (see modeContainerLandscape) -
  // now that there are six modes rather than three, they no longer fit a
  // landscape screen's width unscrolled.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const insets = useSafeAreaInsets();

  // Lets tapping the mascot/title jump straight to the mode cards, and lets
  // scrolling there hide the language button so it stops floating over the
  // cards. The cards' own y position (within the ScrollView's content, not
  // the screen) is captured via onLayout rather than hardcoded, since it
  // shifts with orientation, font scaling and screen size.
  const scrollRef = useRef(null);
  const modesY = useRef(0);
  const handleJumpToModes = () => {
    tapFeedback();
    scrollRef.current?.scrollTo({
      y: Math.max(0, modesY.current - 16),
      animated: true,
    });
  };

  const [languageVisible, setLanguageVisible] = React.useState(true);
  const [languageOpacity] = React.useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(languageOpacity, {
      toValue: languageVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [languageVisible, languageOpacity]);

  // Pauses the Lottie icons while the screen is actively scrolling -
  // smoother on older phones with six animated cards on screen. A parent can
  // turn this off (see ParentArea) to keep them animating always.
  //
  // Driven off onScroll itself (debounced) rather than onScrollBeginDrag/
  // onScrollEndDrag/onMomentumScrollBegin/onMomentumScrollEnd: those fire in
  // matched pairs only when a gesture completes cleanly, and a new touch
  // grabbing the list mid-fling can interrupt momentum without
  // onMomentumScrollEnd ever firing - isScrolling got stuck true forever,
  // freezing these animations permanently after a single scroll. onScroll
  // itself can't get stuck unpaired the same way: it just stops arriving
  // once the list is actually still, which the timeout below detects.
  const [isScrolling, setIsScrolling] = React.useState(false);
  const pauseAnimations = isScrolling && !scrollAnimationsEnabled;
  const scrollIdleTimer = useRef(null);
  useEffect(() => {
    return () => {
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
  }, []);

  const handleScroll = e => {
    if (!modesY.current) return;
    const y = e.nativeEvent.contentOffset.y;
    setLanguageVisible(y < modesY.current - 120);

    setIsScrolling(true);
    if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    scrollIdleTimer.current = setTimeout(() => setIsScrolling(false), 150);
  };

  const lottieRefs = useRef({});

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

  // Only the Lottie icons are paused while scrolling - unlike Lottie's own
  // pause()/resume(), which are built for exactly this, stopping and
  // restarting a native-driven Animated.loop (the title breathe and glyph
  // wiggle below) by calling .start() on the same composite object again
  // turned out to be unreliable on Android: restarting it that way left the
  // glyph icons (letter/trace/album) never visibly animating again, iPhone
  // was fine. Those two are cheap, small-amplitude, native-driver
  // animations anyway - not worth the cross-platform risk to pause - so they
  // are left running continuously and only the Lottie icons react here.
  const isFirstPauseEffect = useRef(true);
  useEffect(() => {
    if (isFirstPauseEffect.current) {
      isFirstPauseEffect.current = false;
      return;
    }
    if (pauseAnimations) {
      Object.values(lottieRefs.current).forEach(ref => ref?.pause());
    } else {
      Object.values(lottieRefs.current).forEach(ref => ref?.resume());
    }
  }, [pauseAnimations]);

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
    <View style={styles.container}>
      <StatusBar style="auto" />

      {/* Main Content */}
      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            isLandscape && styles.contentLandscape,
            {
              paddingTop: insets.top + (isLandscape ? 54 : 64),
              paddingBottom: insets.bottom + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={32}
        >
          <Pressable
            onPress={handleJumpToModes}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yJumpToGames')}
          >
            <Animated.View
              style={{
                alignItems: 'center',
                transform: [
                  { scale: Animated.multiply(titleScale, titleBreatheScale) },
                ],
              }}
            >
              <Image
                source={DOG_MASCOT}
                resizeMode="contain"
                style={isLandscape ? MASCOT_SIZE_LANDSCAPE : MASCOT_SIZE}
              />
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
          </Pressable>

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
          {(() => {
            const modeCards = MODES.map(mode => {
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
                        ref={el => {
                          lottieRefs.current[mode.key] = el;
                        }}
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
            });

            const onLayout = e => {
              modesY.current = e.nativeEvent.layout.y;
            };

            // Portrait stacks cards full-width in the page's own vertical
            // scroll, which already reaches all of them. Landscape lays
            // them out in a row instead - six cards side by side no longer
            // fits any phone or tablet width, so that row needs its own
            // horizontal scroll or the cards past the edge are simply
            // unreachable (there's nothing to swipe).
            return isLandscape ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.modeScrollLandscape}
                contentContainerStyle={styles.modeContainerLandscape}
                onLayout={onLayout}
              >
                {ambientEnabled && <AmbientBackground />}
                {modeCards}
              </ScrollView>
            ) : (
              <View style={styles.modeContainer} onLayout={onLayout}>
                {ambientEnabled && <AmbientBackground />}
                {modeCards}
              </View>
            );
          })()}

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

      {/* Floating, like the Menu/Next Game controls on every game screen.
          Rendered last (after the scrollable content) on purpose - see
          AmbientBackground's own comment for why render order matters here.
          Unlike BackToMenuButton, the absolute positioning is NOT passed as
          a style into the button itself: BouncyButton applies its `style`
          prop to the one child *inside* its Pressable, so a position:
          absolute there can leave the Pressable with nothing in normal flow
          to size itself by. Wrapping it in a plain, separately positioned
          View and leaving the button itself in normal flow avoids that
          ambiguity entirely. */}
      {/* Fades out once scrolled down to the mode cards, so it stops
          floating over them - `none` while hidden so a faded-out button
          can't still eat a tap meant for a card underneath it. */}
      <Animated.View
        pointerEvents={languageVisible ? 'box-none' : 'none'}
        style={[
          styles.languageFloating,
          { top: insets.top + 12, opacity: languageOpacity },
        ]}
      >
        <LanguageToggleButton
          currentLanguage={currentLanguage}
          onToggle={setCurrentLanguage}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  languageFloating: {
    position: 'absolute',
    right: 20,
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
  // Only a contentContainerStyle now (applied to the horizontal ScrollView
  // below), not a plain View's style - see modeScrollLandscape for the
  // ScrollView's own sizing.
  modeContainerLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    paddingHorizontal: 4,
  },
  modeScrollLandscape: {
    width: '100%',
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
  // A fixed width rather than flex:1 - this card now sits in a horizontally
  // scrolling row instead of a fixed-count one, so "share the row equally"
  // no longer makes sense; each card keeps a steady, swipeable size instead.
  // Height is fixed too (not auto, not alignItems:'stretch' on the row),
  // because a 1-line title/description ("Guess the Animal") and a 2-line
  // one ("Learn Animal Sounds & Names") otherwise size their own card
  // differently, leaving a ragged row - content is centered within the
  // fixed height so shorter cards don't look off-balance.
  modeButtonLandscape: {
    width: 210,
    height: 240,
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
