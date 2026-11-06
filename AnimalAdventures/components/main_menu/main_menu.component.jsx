import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';
import ConfettiCannon from 'react-native-confetti-cannon';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { t } from '../../constants';
import {
  CARD_SHADOW,
  CATEGORY_COLORS,
  FONTS,
  PALETTE,
  RADIUS,
  titleText,
} from '../../constants/theme';
import { tapFeedback, selectFeedback } from '../../utils/haptics';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
import { gridColumns, useResponsive } from '../../utils/use-responsive';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';

// Matches the source PNG's own 100:85 aspect ratio, so it isn't stretched.
const MASCOT_ASPECT = 85 / 100;
const MASCOT_WIDTH = 110;
const TILE_GAP = 16;
// Narrowest a menu tile gets before the grid drops a column - two across on
// a phone, three to five on a landscape phone or tablet.
const MIN_TILE_WIDTH = 150;
const BOTTOM_BAR_HEIGHT = 72;

// The app's own dog sublogo mark as a mascot above the title - unlike the
// dog baked into the store icon artwork, it has no background and doesn't
// carry English text that can't switch to Spanish.
const DOG_MASCOT = require('../../assets/logo/appname-sublogo-cute-dog-1.png');
// The mascot's bark reuses the dog's own clip, already loudness-matched to
// the rest of the app's audio - no sudden loud surprise.
const MASCOT_BARK = animalList.find(a => a.id === 'dog-tail-wag')?.sound;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Menu groups, in the order they appear. */
const CATEGORIES = [
  { key: 'listen', titleKey: 'categoryListen', glyph: 'hearing' },
  { key: 'letters', titleKey: 'categoryLetters', glyph: 'sort-by-alpha' },
  { key: 'memory', titleKey: 'categoryMemory', glyph: 'visibility' },
  { key: 'create', titleKey: 'categoryCreate', glyph: 'palette' },
];

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
// `category` places each card in one of the menu's labeled groups and gives
// it that group's pastel (see CATEGORY_COLORS in constants/theme.js), which
// its game screen repeats around the answer cards.
// Exported so the album screen's stars shelf and "found via" badges can
// reuse the same icon/title metadata instead of duplicating it.
export const MODES = [
  {
    key: 'learn',
    category: 'listen',
    icon: require('../../assets/animations/icons/learn_icon.json'),
    glyph: 'explore',
    titleKey: 'modeLearnTitle',
    descriptionKey: 'modeLearnDescription',
  },
  {
    key: 'guess',
    category: 'listen',
    icon: require('../../assets/animations/icons/guess_icon.json'),
    glyph: 'quiz',
    titleKey: 'modeGuessTitle',
    descriptionKey: 'modeGuessDescription',
  },
  {
    key: 'letter',
    category: 'letters',
    icon: require('../../assets/animations/icons/letter_icon.json'),
    glyph: 'sort-by-alpha',
    titleKey: 'modeLetterTitle',
    descriptionKey: 'modeLetterDescription',
  },
  {
    key: 'lastLetter',
    category: 'letters',
    icon: require('../../assets/animations/icons/last_letter_icon.json'),
    glyph: 'sort-by-alpha',
    titleKey: 'modeLastLetterTitle',
    descriptionKey: 'modeLastLetterDescription',
  },
  {
    key: 'trace',
    category: 'letters',
    icon: require('../../assets/animations/icons/trace_icon.json'),
    glyph: 'gesture',
    titleKey: 'modeTraceTitle',
    descriptionKey: 'modeTraceDescription',
  },
  {
    key: 'memory',
    category: 'memory',
    icon: require('../../assets/animations/icons/memory_icon.json'),
    glyph: 'extension',
    titleKey: 'modeMemoryTitle',
    descriptionKey: 'modeMemoryDescription',
  },
  {
    key: 'findAnimal',
    category: 'memory',
    icon: require('../../assets/animations/icons/findAnimal_icon.json'),
    glyph: 'search',
    titleKey: 'modeFindAnimalTitle',
    descriptionKey: 'modeFindAnimalDescription',
  },
  {
    key: 'whoseSound',
    category: 'listen',
    icon: require('../../assets/animations/icons/whoseSound_icon.json'),
    glyph: 'hearing',
    titleKey: 'modeWhoseSoundTitle',
    descriptionKey: 'modeWhoseSoundDescription',
  },
  {
    key: 'buildScene',
    category: 'create',
    icon: require('../../assets/animations/icons/build_scene_icon.json'),
    glyph: 'landscape',
    titleKey: 'modeBuildSceneTitle',
    descriptionKey: 'modeBuildSceneDescription',
  },
  {
    key: 'coloring',
    category: 'create',
    icon: require('../../assets/animations/icons/coloring_icon.json'),
    glyph: 'palette',
    titleKey: 'modeColoringTitle',
    descriptionKey: 'modeColoringDescription',
  },
  {
    key: 'counting',
    category: 'letters',
    icon: require('../../assets/animations/icons/counting_icon.json'),
    glyph: 'format-list-numbered',
    titleKey: 'modeCountingTitle',
    descriptionKey: 'modeCountingDescription',
  },
];

// The album isn't a game to try once and move past like the cards above -
// it's a standing collection a child comes back to, so it lives in the
// always-visible bottom bar instead of competing for a spot in the grid. Kept out of MODES itself: nothing else in the
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
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, scale, contentMaxWidth } = useResponsive();
  // A phone on its side has ~400dp of height: the header, banner and tab bar
  // would take all of it. Compact mode shrinks them so the game tiles show.
  const compact = isLandscape && !isTablet;
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
  const mascotPlayer = useAudioPlayer(null);
  const [showDailyCelebration, setShowDailyCelebration] = useState(false);
  // Imperative play/reset rather than a static `autoPlay` prop, so the same
  // animation can be replayed on tap, not just once on the day's first view.
  const dailyLottieRef = useRef(null);
  const voiceTimer = useRef(null);

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
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(() => {
      playVoice(
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
      releasePlayer(mascotPlayer);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [dailySoundPlayer, dailyVoicePlayer, mascotPlayer]);

  // The title bounces in once and then stays still - motion here is an
  // arrival, not a constant loop competing with the game tiles for a
  // child's attention.
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [titleScale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    Animated.spring(titleScale, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, titleScale]);

  // A small hidden delight: tapping the puppy makes it hop and wiggle with a
  // bark. Gentle by design - a short, familiar sound at the app's normal
  // loudness, never a jump scare.
  const [dance] = useState(() => new Animated.Value(0));
  const handleMascotPress = useCallback(() => {
    tapFeedback();
    if (MASCOT_BARK) playClip(mascotPlayer, MASCOT_BARK);
    dance.setValue(0);
    Animated.timing(dance, {
      toValue: 1,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [dance, mascotPlayer]);
  const danceY = dance.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1],
    outputRange: [0, -18, 0, -12, 0, 0],
  });
  const danceRotate = dance.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: ['0deg', '-10deg', '10deg', '-8deg', '6deg', '0deg'],
  });

  const handleModeSelect = mode => {
    selectFeedback();
    onModeSelect(mode);
  };

  const handleOpenParents = () => {
    tapFeedback();
    onOpenParents();
  };

  // Tile columns come from the content width actually available, so the
  // same grid gives two big tiles on a phone and more on a wide screen.
  const [contentWidth, setContentWidth] = useState(0);
  const columns = gridColumns(
    contentWidth,
    // Tile width grows only a little with the device: bigger screens should
    // show more tiles per row, not a few giant ones.
    MIN_TILE_WIDTH * Math.min(scale, 1.25),
    TILE_GAP,
    2,
    6
  );
  const tileWidth = Math.floor(
    (contentWidth - TILE_GAP * (columns - 1)) / columns
  );
  const iconSize = Math.round(Math.min(tileWidth * 0.5, 100 * scale));

  // Learn Animal Sounds & Names is the gentlest, most passive mode (hear a
  // name, hear a sound) - right for a toddler just meeting these animals,
  // but not worth a slot for an older child who has moved on. Hidden rather
  // than removed: switching the age band back shows it again.
  const visibleModes = MODES.filter(
    mode => mode.key !== 'learn' || childAgeBand === 'under4'
  );

  const mascotWidth = Math.round(
    MASCOT_WIDTH * scale * (compact ? 0.5 : isLandscape ? 0.7 : 1)
  );
  const todaysName =
    currentLanguage === 'en' ? todaysAnimal.name : todaysAnimal.spanish_name;
  const heroAnimalSize = Math.round((compact ? 56 : 96) * scale);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + BOTTOM_BAR_HEIGHT + 24,
          }}
        >
          {/* Red header band - the splash's brand color framing the menu. */}
          <View
            style={[
              styles.band,
              {
                paddingTop: insets.top + (compact ? 4 : 12),
                paddingLeft: insets.left + 20,
                paddingRight: insets.right + 20,
                paddingBottom: compact ? 40 : 64,
              },
            ]}
          >
            {ambientEnabled && <AmbientBackground />}
            <View
              style={[styles.bandTopRow, compact && styles.bandTopRowCompact]}
            >
              <LanguageToggleButton
                currentLanguage={currentLanguage}
                onToggle={setCurrentLanguage}
              />
            </View>
            <View style={[styles.brand, isLandscape && styles.brandRow]}>
              <BouncyButton
                onPress={handleMascotPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yMascot')}
              >
                <Animated.View
                  style={{
                    transform: [
                      { scale: titleScale },
                      { translateY: danceY },
                      { rotate: danceRotate },
                    ],
                  }}
                >
                  <Image
                    source={DOG_MASCOT}
                    resizeMode="contain"
                    style={{
                      width: mascotWidth,
                      height: mascotWidth * MASCOT_ASPECT,
                    }}
                  />
                </Animated.View>
              </BouncyButton>
              <Animated.View
                style={[
                  styles.brandText,
                  isLandscape && styles.brandTextRow,
                  { transform: [{ scale: titleScale }] },
                ]}
              >
                <Text
                  style={[
                    styles.title,
                    {
                      fontSize:
                        42 * scale * (compact ? 0.65 : isLandscape ? 0.8 : 1),
                      lineHeight:
                        54 * scale * (compact ? 0.65 : isLandscape ? 0.8 : 1),
                    },
                  ]}
                  accessibilityRole="header"
                >
                  {t(currentLanguage, 'appTitle')}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { fontSize: (compact ? 16 : 20) * scale },
                  ]}
                >
                  {t(currentLanguage, 'chooseAdventure')}
                </Text>
              </Animated.View>
            </View>
          </View>

          <View
            style={[
              styles.content,
              {
                maxWidth: contentMaxWidth,
                paddingLeft: insets.left + 20,
                paddingRight: insets.right + 20,
              },
            ]}
            onLayout={e =>
              setContentWidth(
                e.nativeEvent.layout.width - (insets.left + insets.right + 40)
              )
            }
          >
            {/* Today's Animal - a daily highlight that overlaps the band
                like a hero banner. A tap hears it, same as the album. */}
            <BouncyButton
              style={[styles.heroCard, compact && styles.heroCardCompact]}
              onPress={handlePlayTodaysAnimal}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yTodaysAnimal', {
                animal: todaysName,
              })}
            >
              <View style={styles.heroBackground} />
              <View style={styles.heroText}>
                <Text style={[styles.heroLabel, { fontSize: 15 * scale }]}>
                  {t(currentLanguage, 'todaysAnimalLabel')}
                </Text>
                <Text
                  style={[
                    styles.heroName,
                    {
                      fontSize: 34 * scale,
                      lineHeight: Math.round(42 * scale),
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {todaysName}
                </Text>
                <View
                  style={[
                    styles.heroListen,
                    compact && styles.heroListenCompact,
                  ]}
                >
                  <MaterialIcons
                    name="volume-up"
                    size={22 * scale}
                    color={PALETTE.ink}
                  />
                </View>
              </View>
              <LottieView
                ref={dailyLottieRef}
                autoPlay={showDailyCelebration}
                loop={false}
                autoSize={false}
                resizeMode="contain"
                source={todaysAnimal.animation_path}
                style={[
                  { width: heroAnimalSize, height: heroAnimalSize },
                  iconScaleStyle(todaysAnimal),
                ]}
              />
            </BouncyButton>

            {contentWidth > 0 &&
              CATEGORIES.map(category => {
                const modes = visibleModes.filter(
                  m => m.category === category.key
                );
                if (modes.length === 0) return null;
                const colors = CATEGORY_COLORS[category.key];
                return (
                  <View key={category.key} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View
                        style={[
                          styles.sectionIcon,
                          { backgroundColor: colors.ring },
                        ]}
                      >
                        <MaterialIcons
                          name={category.glyph}
                          size={20}
                          color={PALETTE.white}
                        />
                      </View>
                      <Text
                        style={[styles.sectionTitle, { color: colors.ink }]}
                        accessibilityRole="header"
                      >
                        {t(currentLanguage, category.titleKey)}
                      </Text>
                    </View>
                    <View style={[styles.tiles, { gap: TILE_GAP }]}>
                      {modes.map(mode => {
                        const title = t(currentLanguage, mode.titleKey);
                        const description = t(
                          currentLanguage,
                          mode.descriptionKey
                        );
                        // Absent for 'learn' - it has no level concept to
                        // earn a star for. See DEFAULT_STARS.
                        const starCount = stars[mode.key]?.length || 0;
                        return (
                          <BouncyButton
                            key={mode.key}
                            style={[
                              styles.tile,
                              { width: tileWidth, minHeight: tileWidth * 0.85 },
                            ]}
                            onPress={() => handleModeSelect(mode.key)}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              currentLanguage,
                              'a11yModeCard',
                              { title, description }
                            )}
                          >
                            {/* Fill on a sibling, not the animated view -
                                see AnswerCard for the Android reason. */}
                            <View
                              style={[
                                styles.tileBackground,
                                {
                                  backgroundColor: colors.fill,
                                  borderColor: colors.ring,
                                },
                              ]}
                            />
                            <LottieView
                              source={mode.icon}
                              autoPlay
                              loop
                              resizeMode="contain"
                              autoSize={false}
                              style={{ width: iconSize, height: iconSize }}
                            />
                            <Text
                              style={[
                                styles.tileTitle,
                                {
                                  fontSize: 20 * scale,
                                  lineHeight: Math.round(26 * scale),
                                },
                              ]}
                            >
                              {title}
                            </Text>
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
                                <MaterialIcons
                                  name="star"
                                  size={16}
                                  color={PALETTE.ink}
                                />
                                <Text style={styles.starBadgeText}>
                                  {starCount}
                                </Text>
                              </View>
                            )}
                          </BouncyButton>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Always-visible bottom bar: the same three destinations in the same
          place every time, each a big icon with a text label. Parents is
          behind the parental gate (handled by App). */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + (compact ? 2 : 8),
            paddingTop: compact ? 2 : 8,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <BottomBarButton
          icon="home"
          label={t(currentLanguage, 'navHome')}
          active
          accessibilityLabel={t(currentLanguage, 'navHome')}
        />
        <BottomBarButton
          icon="collections-bookmark"
          label={t(currentLanguage, 'navAlbum')}
          onPress={() => handleModeSelect(ALBUM_MODE.key)}
          accessibilityLabel={t(currentLanguage, 'a11yModeCard', {
            title: t(currentLanguage, ALBUM_MODE.titleKey),
            description: t(currentLanguage, ALBUM_MODE.descriptionKey),
          })}
        />
        <BottomBarButton
          icon="lock-outline"
          label={t(currentLanguage, 'navParents')}
          onPress={handleOpenParents}
          accessibilityLabel={t(currentLanguage, 'a11yForParents')}
        />
      </View>

      {/* Outside the ScrollView and absolutely positioned, like every other
          ConfettiCannon in this app - rendering it in the scrollable content
          shifts the content height every time it mounts/unmounts. */}
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
    </View>
  );
}

function BottomBarButton({ icon, label, active, onPress, accessibilityLabel }) {
  return (
    <BouncyButton
      style={styles.navButton}
      containerStyle={styles.navButtonContainer}
      onPress={onPress}
      disabled={!onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.navIcon, active && styles.navIconActive]}>
        <MaterialIcons
          name={icon}
          size={26}
          color={active ? PALETTE.white : PALETTE.ink}
        />
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.cream,
  },
  fill: {
    flex: 1,
  },
  band: {
    backgroundColor: PALETTE.red,
    paddingBottom: 64,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  bandTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // Floats the language button over the band's corner so the brand can
  // use the full (short) height.
  bandTopRowCompact: {
    position: 'absolute',
    top: 4,
    right: 20,
    zIndex: 2,
  },
  brand: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: -24,
  },
  brandText: {
    alignItems: 'center',
  },
  brandTextRow: {
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: FONTS.title,
    // Bangers clips on Android without an explicit lineHeight and this.
    includeFontPadding: false,
    color: PALETTE.white,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.gold,
    textAlign: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    marginTop: -44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 120,
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PALETTE.white,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
    borderColor: PALETTE.gold,
    ...CARD_SHADOW,
  },
  heroCardCompact: {
    marginTop: -24,
    minHeight: 76,
    paddingVertical: 8,
  },
  heroListenCompact: {
    display: 'none',
  },
  heroText: {
    flex: 1,
    marginRight: 12,
  },
  heroLabel: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.red,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroName: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    color: PALETTE.ink,
    letterSpacing: 1,
  },
  heroListen: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    padding: 6,
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...titleText(26),
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    gap: 8,
  },
  tileBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.md,
    borderWidth: 3,
    ...CARD_SHADOW,
  },
  tileTitle: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    color: PALETTE.ink,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  starBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: PALETTE.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  starBadgeText: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.ink,
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    ...CARD_SHADOW,
    shadowOffset: { width: 0, height: -3 },
  },
  navButtonContainer: {
    flex: 1,
  },
  navButton: {
    alignItems: 'center',
    gap: 2,
    minHeight: BOTTOM_BAR_HEIGHT - 8,
  },
  navIcon: {
    width: 56,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: PALETTE.red,
  },
  navLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: PALETTE.inkSoft,
  },
  navLabelActive: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.red,
  },
  dailyConfettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default MainMenu;
