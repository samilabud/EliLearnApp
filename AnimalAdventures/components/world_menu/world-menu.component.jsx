import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FitText } from '../utility/fit-text.component';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { t } from '../../constants';
import { WORLDS } from '../../constants/worlds';
import { CATEGORY_COLORS, FONTS, PALETTE, RADIUS } from '../../constants/theme';
import { tapFeedback, selectFeedback } from '../../utils/haptics';
import { loadJSON, saveJSON } from '../../utils/storage';
import { useReduceMotion } from '../../utils/use-reduce-motion';
import { playClip, releasePlayer } from '../../utils/sound';
import { useResponsive } from '../../utils/use-responsive';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useSettings } from '../../contexts/settings.context';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import {
  DOG_MASCOT,
  MASCOT_BARK,
  MODES,
} from '../main_menu/main_menu.component.jsx';
import WorldPage from './world-page.component.jsx';
import { TreasureChest } from './treasure-chest.component.jsx';

const VISITED_KEY = 'worldMenu.visited';
const NUDGE_KEY = 'worldMenu.nudged';
const NUDGE_DISTANCE = 56;
/** How long taps are ignored after a swipe or an arrow press settles. */
/** The dog's hop to a tapped landmark, before the game opens. */
const HOP_MS = 420;
const SETTLE_MS = 250;
/** Long enough to cover a game opening, so a double tap can't open two. */
const LAUNCH_LOCK_MS = 1200;
const MASCOT_ASPECT = 85 / 100;

// Remembered for the session so coming back from a game lands on the world
// the child was playing in, not always the first one.
const memory = { page: 0 };

/**
 * The home screen as a world map: one illustrated page per game category,
 * swiped sideways. Every game is a landmark on its page; the Animal Album is
 * the treasure chest in the corner of every page.
 *
 * Swiping is never the only way around - arrows and tappable dots reach every
 * page - because a two-year-old will not necessarily find the swipe.
 */
export default function WorldMenu({
  onModeSelect,
  currentLanguage,
  setCurrentLanguage,
  onOpenParents,
}) {
  const insets = useSafeAreaInsets();
  const { scale, shortSide, isLandscape } = useResponsive();
  const { stars } = useGameProgress();
  const { childAgeBand } = useSettings();
  const compact = isLandscape && shortSide < 600;

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(memory.page);
  const reduceMotion = useReduceMotion();
  // Which games have been opened from the map. Kept on this device only.
  const [visited, setVisited] = useState([]);
  const [scrollX] = useState(() => new Animated.Value(0));
  const scroller = useRef(null);
  const chestRef = useRef(null);
  const dogRef = useRef(null);
  const [hopX] = useState(() => new Animated.Value(0));
  const [hopY] = useState(() => new Animated.Value(0));
  const [hopLift] = useState(() => new Animated.Value(0));
  const pageRef = useRef(memory.page);
  // Taps before this moment are ignored: mid-swipe, mid-glide, mid-launch.
  const lockUntil = useRef(0);
  const mascotPlayer = useAudioPlayer(null);

  useEffect(() => () => releasePlayer(mascotPlayer), [mascotPlayer]);

  useEffect(() => {
    let cancelled = false;
    loadJSON(VISITED_KEY, []).then(
      list => !cancelled && Array.isArray(list) && setVisited(list)
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleModeKeys = useMemo(
    () =>
      MODES.filter(m => m.key !== 'learn' || childAgeBand === 'under4').map(
        m => m.key
      ),
    [childAgeBand]
  );

  const goTo = useCallback(
    (next, animated = true) => {
      const clamped = Math.max(0, Math.min(WORLDS.length - 1, next));
      lockUntil.current = Date.now() + (animated ? 450 : 0);
      pageRef.current = clamped;
      memory.page = clamped;
      setPage(clamped);
      scroller.current?.scrollTo({ x: clamped * size.width, animated });
    },
    [size.width]
  );

  // Keep the page that was showing when the screen's width changes
  // (rotation, split view).
  useEffect(() => {
    if (size.width > 0) {
      scroller.current?.scrollTo({
        x: pageRef.current * size.width,
        animated: false,
      });
    }
  }, [size.width]);

  // First launch only: a small sideways nudge shows there is more to the
  // right. Skipped under reduced motion; the arrows cover that case.
  useEffect(() => {
    if (size.width === 0 || reduceMotion) return undefined;
    let cancelled = false;
    const timers = [];
    (async () => {
      if (await loadJSON(NUDGE_KEY, false)) return;
      if (cancelled || pageRef.current !== 0) return;
      timers.push(
        setTimeout(() => {
          lockUntil.current = Date.now() + 1200;
          scroller.current?.scrollTo({ x: NUDGE_DISTANCE, animated: true });
          timers.push(
            setTimeout(() => {
              scroller.current?.scrollTo({ x: 0, animated: true });
              saveJSON(NUDGE_KEY, true);
            }, 650)
          );
        }, 1200)
      );
    })();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [size.width, reduceMotion]);

  // A stray edge-swipe must never throw a child out of the app. Back steps
  // toward the first world; on the first world it does nothing (a grown-up
  // leaves with the home button).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pageRef.current > 0) goTo(0);
      return true;
    });
    return () => sub.remove();
  }, [goTo]);

  // Drives the parallax on the native thread - no JS work per frame.
  const [handleScroll] = useState(() =>
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
    })
  );

  // The page indicator follows the swipe, updating only when the nearest
  // page actually changes.
  useEffect(() => {
    if (size.width === 0) return undefined;
    const id = scrollX.addListener(({ value }) => {
      const next = Math.round(value / size.width);
      if (next !== pageRef.current && next >= 0 && next < WORLDS.length) {
        pageRef.current = next;
        memory.page = next;
        setPage(next);
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, size.width]);

  const handleLandmarkPress = useCallback(
    (modeKey, origin) => {
      if (Date.now() < lockUntil.current) return;
      lockUntil.current = Date.now() + LAUNCH_LOCK_MS;
      selectFeedback();
      if (modeKey !== 'album') {
        setVisited(prev => {
          if (prev.includes(modeKey)) return prev;
          const nextList = [...prev, modeKey];
          saveJSON(VISITED_KEY, nextList);
          return nextList;
        });
      }
      // The dog hops over to the landmark first - skipped under reduced
      // motion, and for the Album chest (the dog sits right beside it).
      if (!origin || reduceMotion || modeKey === 'album' || !dogRef.current) {
        onModeSelect(modeKey, origin);
        return;
      }
      dogRef.current.measureInWindow((x, y, w, h) => {
        const dx = origin.x + origin.width / 2 - (x + w / 2);
        const dy = origin.y + origin.height / 2 - (y + h / 2);
        Animated.parallel([
          Animated.timing(hopX, {
            toValue: dx,
            duration: HOP_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hopY, {
            toValue: dy,
            duration: HOP_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(hopLift, {
              toValue: -60,
              duration: HOP_MS / 2,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(hopLift, {
              toValue: 0,
              duration: HOP_MS / 2,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          onModeSelect(modeKey, origin);
          // Back home by the time the child returns to the map.
          setTimeout(() => {
            hopX.setValue(0);
            hopY.setValue(0);
          }, 600);
        });
      });
    },
    [onModeSelect, reduceMotion, hopX, hopY, hopLift]
  );

  const handleMascot = () => {
    tapFeedback();
    if (MASCOT_BARK) playClip(mascotPlayer, MASCOT_BARK);
  };

  const handleOpenParents = () => {
    tapFeedback();
    onOpenParents();
  };

  const world = WORLDS[page];
  const colors = CATEGORY_COLORS[world.category];
  const landmarkSize = Math.round(
    Math.max(
      100,
      Math.min(200, Math.min(size.width, size.height) * (compact ? 0.26 : 0.3))
    )
  );
  const nav = Math.round((compact ? 52 : 60) * Math.min(scale, 1.3));
  const mascotWidth = Math.round((compact ? 64 : 84) * Math.min(scale, 1.4));
  const chestSize = Math.round((compact ? 70 : 88) * Math.min(scale, 1.4));
  const landscape = size.width > size.height;
  const prev = WORLDS[page - 1];
  const next = WORLDS[page + 1];

  return (
    <View
      style={styles.container}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setSize(s =>
          s.width === width && s.height === height ? s : { width, height }
        );
      }}
    >
      <StatusBar style="dark" />

      {size.width > 0 && (
        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollBeginDrag={() => {
            lockUntil.current = Number.MAX_SAFE_INTEGER;
          }}
          onScrollEndDrag={() => {
            lockUntil.current = Date.now() + SETTLE_MS * 2;
          }}
          onMomentumScrollEnd={() => {
            lockUntil.current = Date.now() + SETTLE_MS;
          }}
        >
          {WORLDS.map((w, i) => (
            <WorldPage
              key={w.key}
              world={w}
              index={i}
              width={size.width}
              height={size.height}
              scrollX={scrollX}
              active={i === page}
              reduceMotion={reduceMotion}
              currentLanguage={currentLanguage}
              landmarkSize={landmarkSize}
              scale={Math.min(scale, 1.4)}
              visibleModeKeys={visibleModeKeys}
              stars={stars}
              visited={visited}
              onLandmarkPress={handleLandmarkPress}
            />
          ))}
        </Animated.ScrollView>
      )}

      {/* Top bar: language, which world this is, grown-ups. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.topBar,
          {
            top: insets.top + (compact ? 4 : 10),
            left: insets.left + 16,
            right: insets.right + 16,
          },
        ]}
      >
        <LanguageToggleButton
          currentLanguage={currentLanguage}
          onToggle={setCurrentLanguage}
        />
        <View style={styles.titlePill} accessible accessibilityRole="header">
          <View
            style={[styles.titlePillFill, { borderColor: colors.ring }]}
            importantForAccessibility="no"
          />
          <MaterialIcons name={world.glyph} size={24} color={colors.ink} />
          <FitText
            style={[
              styles.title,
              { color: colors.ink, fontSize: 26 * Math.min(scale, 1.3) },
            ]}
            maxLines={2}
            minScale={0.7}
          >
            {t(currentLanguage, world.titleKey)}
          </FitText>
        </View>
        <BouncyButton
          style={[styles.roundButton, { width: nav, height: nav }]}
          onPress={handleOpenParents}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t(currentLanguage, 'a11yForParents')}
        >
          <MaterialIcons name="lock-outline" size={26} color={PALETTE.ink} />
        </BouncyButton>
      </View>

      {/* Bottom area. Portrait stacks two rows so nothing shares a row:
          the dog and treasure chest above, the way around below. Landscape
          has the width to put all three on one row. */}
      <View
        pointerEvents="box-none"
        style={[
          landscape ? styles.bottomRow : styles.bottomStack,
          {
            bottom: insets.bottom + (compact ? 6 : 14),
            left: insets.left + 12,
            right: insets.right + 12,
          },
        ]}
      >
        {landscape ? (
          <>
            <BouncyButton
              onPress={handleMascot}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMascot')}
            >
              <Animated.View
                ref={dogRef}
                collapsable={false}
                style={{
                  transform: [
                    { translateX: hopX },
                    { translateY: Animated.add(hopY, hopLift) },
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

            <View
              style={[styles.nav, landscape && styles.navGrow]}
              pointerEvents="box-none"
            >
              <View style={{ width: nav }}>
                {prev && (
                  <BouncyButton
                    style={[styles.roundButton, { width: nav, height: nav }]}
                    onPress={() => goTo(page - 1)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t(currentLanguage, 'a11yPrevWorld', {
                      title: t(currentLanguage, prev.titleKey),
                    })}
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={nav * 0.7}
                      color={PALETTE.ink}
                    />
                  </BouncyButton>
                )}
              </View>
              <View style={styles.dots}>
                {WORLDS.map((w, i) => {
                  const active = i === page;
                  return (
                    <BouncyButton
                      key={w.key}
                      containerStyle={styles.dotHit}
                      onPress={() => goTo(i)}
                      accessible
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t(currentLanguage, 'a11yWorldDot', {
                        title: t(currentLanguage, w.titleKey),
                        n: i + 1,
                        total: WORLDS.length,
                      })}
                    >
                      <View
                        style={[
                          styles.dot,
                          active && {
                            width: 28,
                            backgroundColor: CATEGORY_COLORS[w.category].ring,
                          },
                        ]}
                      />
                    </BouncyButton>
                  );
                })}
              </View>
              <View style={{ width: nav }}>
                {next && (
                  <BouncyButton
                    style={[styles.roundButton, { width: nav, height: nav }]}
                    onPress={() => goTo(page + 1)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t(currentLanguage, 'a11yNextWorld', {
                      title: t(currentLanguage, next.titleKey),
                    })}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={nav * 0.7}
                      color={PALETTE.ink}
                    />
                  </BouncyButton>
                )}
              </View>
            </View>

            <BouncyButton
              ref={chestRef}
              onPress={() =>
                chestRef.current
                  ? chestRef.current.measureInWindow((x, y, width, height) =>
                      handleLandmarkPress('album', {
                        x,
                        y,
                        width,
                        height,
                        color: '#FFE873',
                      })
                    )
                  : handleLandmarkPress('album')
              }
              style={styles.chest}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yTreasureChest', {
                description: t(currentLanguage, 'albumDescription'),
              })}
            >
              <TreasureChest size={chestSize} />
              <View style={styles.chestLabel}>
                <Text style={styles.chestLabelText}>
                  {t(currentLanguage, 'navAlbum')}
                </Text>
              </View>
            </BouncyButton>
          </>
        ) : (
          <>
            <View style={styles.friendsRow} pointerEvents="box-none">
              <BouncyButton
                onPress={handleMascot}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yMascot')}
              >
                <Animated.View
                  ref={dogRef}
                  collapsable={false}
                  style={{
                    transform: [
                      { translateX: hopX },
                      { translateY: Animated.add(hopY, hopLift) },
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

              <BouncyButton
                ref={chestRef}
                onPress={() =>
                  chestRef.current
                    ? chestRef.current.measureInWindow((x, y, width, height) =>
                        handleLandmarkPress('album', {
                          x,
                          y,
                          width,
                          height,
                          color: '#FFE873',
                        })
                      )
                    : handleLandmarkPress('album')
                }
                style={styles.chest}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yTreasureChest', {
                  description: t(currentLanguage, 'albumDescription'),
                })}
              >
                <TreasureChest size={chestSize} />
                <View style={styles.chestLabel}>
                  <Text style={styles.chestLabelText}>
                    {t(currentLanguage, 'navAlbum')}
                  </Text>
                </View>
              </BouncyButton>
            </View>
            <View style={styles.nav} pointerEvents="box-none">
              <View style={{ width: nav }}>
                {prev && (
                  <BouncyButton
                    style={[styles.roundButton, { width: nav, height: nav }]}
                    onPress={() => goTo(page - 1)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t(currentLanguage, 'a11yPrevWorld', {
                      title: t(currentLanguage, prev.titleKey),
                    })}
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={nav * 0.7}
                      color={PALETTE.ink}
                    />
                  </BouncyButton>
                )}
              </View>
              <View style={styles.dots}>
                {WORLDS.map((w, i) => {
                  const active = i === page;
                  return (
                    <BouncyButton
                      key={w.key}
                      containerStyle={styles.dotHit}
                      onPress={() => goTo(i)}
                      accessible
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t(currentLanguage, 'a11yWorldDot', {
                        title: t(currentLanguage, w.titleKey),
                        n: i + 1,
                        total: WORLDS.length,
                      })}
                    >
                      <View
                        style={[
                          styles.dot,
                          active && {
                            width: 28,
                            backgroundColor: CATEGORY_COLORS[w.category].ring,
                          },
                        ]}
                      />
                    </BouncyButton>
                  );
                })}
              </View>
              <View style={{ width: nav }}>
                {next && (
                  <BouncyButton
                    style={[styles.roundButton, { width: nav, height: nav }]}
                    onPress={() => goTo(page + 1)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t(currentLanguage, 'a11yNextWorld', {
                      title: t(currentLanguage, next.titleKey),
                    })}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={nav * 0.7}
                      color={PALETTE.ink}
                    />
                  </BouncyButton>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#CDEBFF' },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  // Fill and ring on a sibling so Android cannot clip the wrapped title.
  titlePillFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  title: {
    flexShrink: 1,
    fontFamily: FONTS.title,
    includeFontPadding: false,
    letterSpacing: 0.8,
  },
  roundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: '#D5E3EC',
  },
  bottomStack: {
    position: 'absolute',
    gap: 6,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bottomRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  navGrow: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotHit: { padding: 8 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(10,61,98,0.35)',
    borderWidth: 2,
    borderColor: PALETTE.white,
  },
  chest: { alignItems: 'center' },
  chestLabel: {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  chestLabelText: {
    fontFamily: FONTS.title,
    fontSize: 18,
    lineHeight: 22,
    includeFontPadding: false,
    color: PALETTE.ink,
  },
});
