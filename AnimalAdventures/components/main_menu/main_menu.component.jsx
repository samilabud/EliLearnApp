import React, { useCallback, useEffect, useRef } from 'react';
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
import { useAudioPlayer } from 'expo-audio';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback, selectFeedback } from '../../utils/haptics';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import { playClip, releasePlayer } from '../../utils/sound';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';

const ICON_SIZE = { width: 90, height: 90 };
const ICON_SIZE_LANDSCAPE = { width: 60, height: 60 };
// Vertical space the always-visible Album pill (see topRightFloating/
// albumButton below) reserves above the language toggle, so the two
// top-right floating controls never overlap: the pill's own minHeight
// (MIN_TOUCH_TARGET) plus a comfortable gap.
const ALBUM_PILL_CLEARANCE = 58;
// Matches the source PNG's own 100:85 aspect ratio, so it isn't stretched.
const MASCOT_SIZE = { width: 110, height: 94 };
const MASCOT_SIZE_LANDSCAPE = { width: 64, height: 54 };

// The app's own dog sublogo mark as a mascot above the title - unlike the
// dog baked into the store icon artwork, it has no background and doesn't
// carry English text that can't switch to Spanish.
const DOG_MASCOT = require('../../assets/logo/appname-sublogo-cute-dog-1.png');

const DAY_MS = 24 * 60 * 60 * 1000;

// Every card now has its own small, hand-authored Lottie (a few KB each,
// vector shapes only, no embedded images) - a consistent custom set instead
// of the old mismatch of 3 rich character illustrations next to 5 plain
// MaterialIcons glyphs. `glyph` is kept on each entry too: it's not used on
// the menu card itself, but the album's "found via" badge on a met animal
// (a ~20px corner badge, potentially many on screen in the grid at once)
// needs something far cheaper than a full Lottie composition.
//
// The cards differ only by icon and copy, so they are described once here
// and rendered in a loop. Keeps their accessibility wiring identical.
// Exported so the album screen's stars shelf and "found via" badges can
// reuse the same icon/title metadata instead of duplicating it.
export const MODES = [
  {
    key: 'learn',
    icon: require('../../assets/animations/icons/learn_icon.json'),
    glyph: 'explore',
    titleKey: 'modeLearnTitle',
    descriptionKey: 'modeLearnDescription',
  },
  {
    key: 'guess',
    icon: require('../../assets/animations/icons/guess_icon.json'),
    glyph: 'quiz',
    titleKey: 'modeGuessTitle',
    descriptionKey: 'modeGuessDescription',
  },
  {
    key: 'letter',
    icon: require('../../assets/animations/icons/letter_icon.json'),
    glyph: 'sort-by-alpha',
    titleKey: 'modeLetterTitle',
    descriptionKey: 'modeLetterDescription',
  },
  {
    key: 'trace',
    icon: require('../../assets/animations/icons/trace_icon.json'),
    glyph: 'gesture',
    titleKey: 'modeTraceTitle',
    descriptionKey: 'modeTraceDescription',
  },
  {
    key: 'memory',
    icon: require('../../assets/animations/icons/memory_icon.json'),
    glyph: 'extension',
    titleKey: 'modeMemoryTitle',
    descriptionKey: 'modeMemoryDescription',
  },
  {
    key: 'findAnimal',
    icon: require('../../assets/animations/icons/findAnimal_icon.json'),
    glyph: 'search',
    titleKey: 'modeFindAnimalTitle',
    descriptionKey: 'modeFindAnimalDescription',
  },
  {
    key: 'whoseSound',
    icon: require('../../assets/animations/icons/whoseSound_icon.json'),
    glyph: 'hearing',
    titleKey: 'modeWhoseSoundTitle',
    descriptionKey: 'modeWhoseSoundDescription',
  },
  {
    key: 'buildScene',
    icon: require('../../assets/animations/icons/build_scene_icon.json'),
    glyph: 'landscape',
    titleKey: 'modeBuildSceneTitle',
    descriptionKey: 'modeBuildSceneDescription',
  },
  {
    key: 'coloring',
    icon: require('../../assets/animations/icons/coloring_icon.json'),
    glyph: 'palette',
    titleKey: 'modeColoringTitle',
    descriptionKey: 'modeColoringDescription',
  },
  {
    key: 'counting',
    icon: require('../../assets/animations/icons/counting_icon.json'),
    glyph: 'format-list-numbered',
    titleKey: 'modeCountingTitle',
    descriptionKey: 'modeCountingDescription',
  },
];

// The album isn't a game to try once and move past like the cards above -
// it's a standing collection a child comes back to, so it lives as its own
// persistent icon near the top instead of competing for a spot (and a
// scroll) in the mode grid. Kept out of MODES itself: nothing else in the
// app treats 'album' as a playable mode or a "found via" source.
const ALBUM_MODE = {
  key: 'album',
  glyph: 'collections-bookmark',
  titleKey: 'albumTitle',
  descriptionKey: 'albumDescription',
};

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
  const { stars, hasSeenTodaysAnimal, markDailyAnimalCelebrated } =
    useGameProgress();
  const { childAgeBand } = useSettings();

  // A deterministic pick, not a random one, so it's the same animal all day
  // and across every device - just an index into the list that changes once
  // every 24 hours, no persistence needed.
  const todaysAnimal =
    animalList[Math.floor(new Date() / DAY_MS) % animalList.length];

  const dailySoundPlayer = useAudioPlayer(null);
  const dailyVoicePlayer = useAudioPlayer(null);
  const [showDailyCelebration, setShowDailyCelebration] = React.useState(false);
  // Imperative play/reset rather than a static `autoPlay` prop, so the same
  // animation can be replayed on tap, not just once on the day's first view.
  const dailyLottieRef = useRef(null);

  // Fires once per calendar day, the first time the menu is seen that day -
  // a little surprise rather than something a child has to go looking for.
  useEffect(() => {
    if (hasSeenTodaysAnimal) return;
    setShowDailyCelebration(true);
    dailyLottieRef.current?.play();
    markDailyAnimalCelebrated();
    const timer = setTimeout(() => setShowDailyCelebration(false), 2600);
    return () => clearTimeout(timer);
    // Runs once per mount - re-checking on every render would fire again if
    // hasSeenTodaysAnimal's underlying state updates before this effect's own
    // write is persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayTodaysAnimal = useCallback(() => {
    tapFeedback();
    dailyLottieRef.current?.reset();
    dailyLottieRef.current?.play();
    playClip(dailySoundPlayer, todaysAnimal.sound);
    // Staggered rather than simultaneous, so the sound and the spoken name
    // don't talk over each other - same pairing the album screen uses.
    setTimeout(() => {
      playClip(
        dailyVoicePlayer,
        currentLanguage === 'en'
          ? todaysAnimal.voice
          : todaysAnimal.spanish_voice
      );
    }, 1000);
  }, [dailySoundPlayer, dailyVoicePlayer, todaysAnimal, currentLanguage]);

  useEffect(() => {
    return () => {
      releasePlayer(dailySoundPlayer);
      releasePlayer(dailyVoicePlayer);
    };
  }, [dailySoundPlayer, dailyVoicePlayer]);

  const [titleScale] = React.useState(() => new Animated.Value(0.6));
  const [titleBreathe] = React.useState(() => new Animated.Value(0));
  const [subtitleSlide] = React.useState(() => new Animated.Value(20));
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

  // The top-left Parents shortcut is only meant to greet a parent right
  // after launch, before a child has started scrolling/playing - so unlike
  // the language/album controls (which stay up until the cards scroll under
  // them), this one disappears the moment there's any scroll at all, not
  // just once the cards arrive.
  const [topParentsVisible, setTopParentsVisible] = React.useState(true);
  const [topParentsOpacity] = React.useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(topParentsOpacity, {
      toValue: topParentsVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [topParentsVisible, topParentsOpacity]);

  const handleScroll = e => {
    const y = e.nativeEvent.contentOffset.y;
    setTopParentsVisible(y <= 4);
    if (!modesY.current) return;
    setLanguageVisible(y < modesY.current - 120);
  };

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
  }, [fadeAnim, titleScale, titleBreathe, subtitleSlide]);

  const handleModeSelect = mode => {
    selectFeedback();
    onModeSelect(mode);
  };

  const titleBreatheScale = titleBreathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
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

          <Animated.View style={{ transform: [{ translateY: subtitleSlide }] }}>
            <Text
              style={[styles.subtitle, isLandscape && styles.subtitleLandscape]}
            >
              {t(currentLanguage, 'chooseAdventure')}
            </Text>
          </Animated.View>

          {/* Today's Animal - a small daily highlight, not another mode to
              pick. A tap just hears it, same as a met card in the album. */}
          <BouncyButton
            style={styles.dailyCard}
            onPress={handlePlayTodaysAnimal}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yTodaysAnimal', {
              animal:
                currentLanguage === 'en'
                  ? todaysAnimal.name
                  : todaysAnimal.spanish_name,
            })}
          >
            <LottieView
              ref={dailyLottieRef}
              autoPlay={showDailyCelebration}
              loop={false}
              autoSize={false}
              resizeMode="contain"
              source={todaysAnimal.animation_path}
              style={styles.dailyAnimation}
            />
            <View>
              <Text style={styles.dailyLabel}>
                {t(currentLanguage, 'todaysAnimalLabel')}
              </Text>
              <Text
                style={[styles.dailyName, { fontFamily: 'Bangers_400Regular' }]}
              >
                {currentLanguage === 'en'
                  ? todaysAnimal.name
                  : todaysAnimal.spanish_name}
              </Text>
            </View>
          </BouncyButton>

          {/* Mode Selection Buttons */}
          {(() => {
            // Learn Animal Sounds & Names is the gentlest, most passive mode
            // (hear a name, hear a sound) - right for a toddler just meeting
            // these animals, but not worth a slot for an older child who has
            // moved on to the active games below it. Hidden rather than
            // removed: switching the age band back shows it again, nothing
            // about it is lost.
            const visibleModes = MODES.filter(
              mode => mode.key !== 'learn' || childAgeBand === 'under4'
            );
            const modeCards = visibleModes.map(mode => {
              const title = t(currentLanguage, mode.titleKey);
              const description = t(currentLanguage, mode.descriptionKey);
              // Absent for 'learn' - it has no level concept to earn a star
              // for. See DEFAULT_STARS in game-progress.context.
              const starCount = stars[mode.key]?.length || 0;

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
                    <LottieView
                      source={mode.icon}
                      autoPlay
                      loop
                      resizeMode="contain"
                      style={isLandscape ? ICON_SIZE_LANDSCAPE : ICON_SIZE}
                      autoSize={false}
                    />
                    {starCount > 0 && (
                      <View
                        style={styles.starBadge}
                        accessible={true}
                        accessibilityLabel={t(
                          currentLanguage,
                          'a11yStarBadge',
                          { count: starCount, title }
                        )}
                      >
                        <MaterialIcons name="star" size={14} color="white" />
                        <Text style={styles.starBadgeText}>{starCount}</Text>
                      </View>
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

      {/* Outside the ScrollView and absolutely positioned, like every other
          ConfettiCannon in this app (see feedbackOverlay/completionOverlay in
          the games) - rendering it in the scrollable content instead shifts
          the content height every time it mounts/unmounts, which was
          disrupting the mode cards' own layout and animations below it. */}
      {showDailyCelebration && (
        <View pointerEvents="none" style={styles.dailyConfettiOverlay}>
          <ConfettiCannon
            count={60}
            fadeOut={true}
            explosionSpeed={300}
            fallSpeed={3000}
            origin={{ x: 0, y: 0 }}
          />
        </View>
      )}

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
      {/* The Album, unlike the language toggle below, stays visible and
          reachable the whole time the menu is open - it's a destination a
          child comes back to, not a secondary control, so it doesn't fade
          out once they start scrolling through the games (the opposite
          would mean a child who's exploring the game list loses the one
          button that gets them to their own collection). Labeled with
          text, not just an icon, for the same reason the Parents button
          below is: a bare icon isn't "clear" for a child who can't yet
          read icon conventions. */}
      <View style={[styles.topRightFloating, { top: insets.top + 12 }]}>
        <BouncyButton
          style={styles.albumButton}
          onPress={() => handleModeSelect(ALBUM_MODE.key)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yModeCard', {
            title: t(currentLanguage, ALBUM_MODE.titleKey),
            description: t(currentLanguage, ALBUM_MODE.descriptionKey),
          })}
        >
          <MaterialIcons name={ALBUM_MODE.glyph} size={18} color="#0A3D62" />
          <Text style={styles.albumButtonText}>
            {t(currentLanguage, ALBUM_MODE.titleKey)}
          </Text>
        </BouncyButton>
      </View>

      {/* Fades out once scrolled down to the mode cards, so it stops
          floating over them - `none` while hidden so a faded-out button
          can't still eat a tap meant for a card underneath it. */}
      <Animated.View
        pointerEvents={languageVisible ? 'box-none' : 'none'}
        style={[
          styles.languageFloating,
          { top: insets.top + 12 + ALBUM_PILL_CLEARANCE, opacity: languageOpacity },
        ]}
      >
        <LanguageToggleButton
          currentLanguage={currentLanguage}
          onToggle={setCurrentLanguage}
        />
      </Animated.View>

      {/* Top-left, mirroring the language/album row on the right, but gone
          the moment there's any scroll at all - this one is purely a "a
          parent just opened the app" shortcut, not a persistent control a
          child would otherwise tap into by accident while browsing games.
          The plain bottom "For Parents" link stays too, for anyone who
          scrolls past this without noticing it. */}
      <Animated.View
        pointerEvents={topParentsVisible ? 'box-none' : 'none'}
        style={[
          styles.topParentsFloating,
          { top: insets.top + 12, opacity: topParentsOpacity },
        ]}
      >
        <BouncyButton
          style={styles.topParentsButton}
          onPress={() => {
            tapFeedback();
            onOpenParents();
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yForParents')}
        >
          <MaterialIcons name="lock-outline" size={18} color="#0A3D62" />
          <Text style={styles.topParentsText}>
            {t(currentLanguage, 'forParents')}
          </Text>
        </BouncyButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  topRightFloating: {
    position: 'absolute',
    right: 20,
  },
  // Same labeled-pill shape as topParentsButton below - icon + text, not
  // an icon alone, per Google's "clear, consistent interactive elements"
  // guidance for this age range.
  albumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  albumButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3D62',
  },
  // Positioned below the always-visible Album pill above it (see the
  // inline `top` offset where this is used), so the two never overlap -
  // this one still fades out on scroll (see its own comment above), the
  // Album one no longer does.
  languageFloating: {
    position: 'absolute',
    right: 20,
  },
  topParentsFloating: {
    position: 'absolute',
    left: 20,
  },
  topParentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  topParentsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3D62',
  },
  dailyConfettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    maxWidth: 320,
    alignSelf: 'center',
  },
  dailyAnimation: {
    width: 56,
    height: 56,
  },
  dailyLabel: {
    fontSize: 13,
    color: '#5A5A5A',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dailyName: {
    fontSize: 22,
    lineHeight: 28,
    includeFontPadding: false,
    color: '#0A3D62',
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
  // Positioned relative to modeIconContainer (every View is a valid
  // absolute-positioning context in React Native, no explicit
  // position:'relative' needed on the parent).
  starBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  starBadgeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
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
