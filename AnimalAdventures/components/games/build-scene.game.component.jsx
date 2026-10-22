import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { t } from '../../constants';
import { animalList } from '../animals/animal.list';
import { sceneryList } from '../scenery/scenery.list';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import { tapFeedback, successFeedback } from '../../utils/haptics';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import { NextGameButton } from '../utility/next-game-button.component';
import {
  BackToMenuButton,
  BACK_TO_MENU_CLEARANCE,
} from '../utility/back-to-menu-button.component';
import { ConfirmResetButton } from '../utility/confirm-reset-button.component';

const TRAY_ITEM_SIZE = 64;
const PLACED_ITEM_SIZE = 80;
// How far a touch has to travel before a placed animal's release counts as
// a drag rather than a tap.
const TAP_SLOP = 6;

/**
 * One draggable item - an animal or a scenery object, either a tray
 * thumbnail (the source) or an instance already placed in the scene. It
 * owns only gesture *recognition* (tap vs drag, and for tray items,
 * vertical-vs-horizontal so a tray swipe can still scroll); it does not
 * animate its own visual position.
 *
 * That split matters: a tray item lives inside the tray's horizontally
 * scrolling container, which clips its content to its own bounds the moment
 * something moves outside them - exactly what a drag needs to do to reach
 * the scene above it. Animating the item in place made it invisible for the
 * whole drag (it only reappeared on release, once the drop had already been
 * decided). The fix is reporting raw screen coordinates up to the parent,
 * which renders a single ghost at the screen's root - a sibling of the tray
 * and scene, not a child of either, so nothing clips it.
 */
function DraggableItem({
  item,
  currentLanguage,
  size,
  isPlaced,
  left,
  top,
  hidden,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
}) {
  const [panResponder, setPanResponder] = useState(null);
  const movedRef = useRef(false);

  // Latest-ref dance so the responder's callbacks (created once below) never
  // close over stale props from an earlier render - same reasoning as
  // scheduleEvaluateRef in trace-letter.game.component.jsx.
  const onTapRef = useRef(onTap);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => {
    onTapRef.current = onTap;
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onTap, onDragStart, onDragMove, onDragEnd]);

  useEffect(() => {
    setPanResponder(
      PanResponder.create(
        isPlaced
          ? {
              onStartShouldSetPanResponder: () => true,
              onStartShouldSetPanResponderCapture: () => true,
              onPanResponderGrant: evt => {
                movedRef.current = false;
                onDragStartRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY
                );
              },
              onPanResponderMove: (evt, gestureState) => {
                if (
                  Math.abs(gestureState.dx) > TAP_SLOP ||
                  Math.abs(gestureState.dy) > TAP_SLOP
                ) {
                  movedRef.current = true;
                }
                onDragMoveRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY
                );
              },
              onPanResponderRelease: evt => {
                onDragEndRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY,
                  movedRef.current
                );
                if (!movedRef.current) onTapRef.current?.();
              },
              onPanResponderTerminate: evt => {
                onDragEndRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY,
                  false
                );
              },
            }
          : {
              // Only claims a gesture that's clearly more vertical than
              // horizontal, so a swipe meant to scroll the tray is declined
              // here and falls through to the tray's own ScrollView - the
              // same "let the more specific gesture lose gracefully" trick
              // trace-letter.game.component.jsx uses for its canvas vs its
              // parent ScrollView.
              onMoveShouldSetPanResponder: (evt, gestureState) =>
                Math.abs(gestureState.dy) > Math.abs(gestureState.dx) + 4,
              onMoveShouldSetPanResponderCapture: (evt, gestureState) =>
                Math.abs(gestureState.dy) > Math.abs(gestureState.dx) + 4,
              onPanResponderGrant: evt => {
                onDragStartRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY
                );
              },
              onPanResponderMove: evt => {
                onDragMoveRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY
                );
              },
              onPanResponderRelease: evt => {
                onDragEndRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY,
                  true
                );
              },
              onPanResponderTerminate: evt => {
                onDragEndRef.current?.(
                  evt.nativeEvent.pageX,
                  evt.nativeEvent.pageY,
                  false
                );
              },
            }
      )
    );
    // Built once per mount - the latest-ref pair above is what keeps its
    // callbacks fresh, not recreating it.
  }, [isPlaced]);

  if (!panResponder) return null;

  const name = currentLanguage === 'en' ? item.name : item.spanish_name;

  return (
    <View
      {...panResponder.panHandlers}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={t(
        currentLanguage,
        isPlaced ? 'a11yPlacedAnimal' : 'a11yTrayAnimal',
        { animal: name }
      )}
      style={[
        { width: size, height: size, opacity: hidden ? 0 : 1 },
        isPlaced && { position: 'absolute', left, top },
      ]}
    >
      <LottieView
        autoPlay={false}
        loop={false}
        autoSize={false}
        resizeMode="contain"
        source={item.animation_path}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

// `ambientEnabled` is intentionally not accepted here - the floating-bubble
// effect (see ambient-background.component.js) is designed for a uniform
// full-bleed background, not this screen's boxed sky/ground diorama. Mixing
// them produced stray circle fragments clipped against the scene's rounded
// border on a real device.
export default function BuildSceneGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const insets = useSafeAreaInsets();
  const {
    scene,
    addPlacedItem,
    movePlacedItem,
    removePlacedItem,
    resetScene,
    markAnimalMet,
  } = useGameProgress();

  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const voiceTimer = useRef(null);

  const sceneRef = useRef(null);
  const scenePageRef = useRef({ x: 0, y: 0 });
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });

  // The single drag ghost, rendered at the root (see DraggableItem's own
  // comment for why). `ghostPan` drives its position directly via Animated,
  // not React state, so a finger moving at 60fps doesn't re-render the
  // screen on every frame - only `drag` itself (which item/size to show,
  // and which original to hide) changes on a real render.
  const [ghostPan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [drag, setDrag] = useState(null); // { key, item, size } | null

  useEffect(() => {
    track(scene.placed.length > 0 ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'buildScene',
    });
    // Fires once per visit to the screen, not once per placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      releasePlayer(soundPlayer);
      releasePlayer(voicePlayer);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [soundPlayer, voicePlayer]);

  // Scenery has no sound/voice of its own (it's set dressing, not something
  // to learn a name or sound for - see scenery.list.js) - this is a no-op
  // for those rather than every call site needing to check first.
  const playAnimal = useCallback(
    animal => {
      if (!animal.sound) return;
      playClip(soundPlayer, animal.sound);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => {
        playClip(
          voicePlayer,
          currentLanguage === 'en' ? animal.voice : animal.spanish_voice
        );
      }, 1000);
    },
    [soundPlayer, voicePlayer, currentLanguage]
  );

  const handleSceneLayout = useCallback(e => {
    const { width, height } = e.nativeEvent.layout;
    setSceneSize({ width, height });
    sceneRef.current?.measureInWindow((x, y) => {
      scenePageRef.current = { x, y };
    });
  }, []);

  /**
   * Translate an absolute screen drop point into a 0-1 position within the
   * scene, or null if the drop landed outside it. Normalized rather than
   * pixel-based so a saved scene still makes sense after a rotation or on a
   * different screen size.
   */
  const resolveDrop = useCallback(
    (pageX, pageY) => {
      const { x: sx, y: sy } = scenePageRef.current;
      const { width, height } = sceneSize;
      if (width === 0 || height === 0) return null;
      const localX = pageX - sx;
      const localY = pageY - sy;
      if (localX < 0 || localX > width || localY < 0 || localY > height) {
        return null;
      }
      return { x: localX / width, y: localY / height };
    },
    [sceneSize]
  );

  const beginDrag = useCallback(
    (key, item, size, pageX, pageY) => {
      ghostPan.setValue({ x: pageX - size / 2, y: pageY - size / 2 });
      setDrag({ key, item, size });
    },
    [ghostPan]
  );

  const moveDrag = useCallback(
    (pageX, pageY) => {
      setDrag(current => {
        if (!current) return current;
        ghostPan.setValue({
          x: pageX - current.size / 2,
          y: pageY - current.size / 2,
        });
        return current;
      });
    },
    [ghostPan]
  );

  const handleTrayDragEnd = useCallback(
    (item, kind, pageX, pageY, moved) => {
      setDrag(null);
      if (!moved) return;
      const pos = resolveDrop(pageX, pageY);
      if (!pos) return;
      tapFeedback();
      successFeedback();
      addPlacedItem(item.id, kind, pos.x, pos.y);
      if (kind === 'animal') {
        markAnimalMet(item.id, 'buildScene');
        playAnimal(item);
      }
    },
    [resolveDrop, addPlacedItem, markAnimalMet, playAnimal]
  );

  const handlePlacedDragEnd = useCallback(
    (instanceId, pageX, pageY, moved) => {
      setDrag(null);
      if (!moved) return;
      const pos = resolveDrop(pageX, pageY);
      if (pos) {
        movePlacedItem(instanceId, pos.x, pos.y);
      } else {
        tapFeedback();
        removePlacedItem(instanceId);
      }
    },
    [resolveDrop, movePlacedItem, removePlacedItem]
  );

  const handlePlacedTap = useCallback(
    item => {
      tapFeedback();
      playAnimal(item);
    },
    [playAnimal]
  );

  const handleReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'buildScene' });
    resetScene();
  }, [resetScene]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    onBackToMenu();
  }, [onBackToMenu]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    onNextGame();
  }, [onNextGame]);

  const animalsById = useMemo(() => {
    const lookup = {};
    animalList.forEach(a => {
      lookup[a.id] = a;
    });
    return lookup;
  }, []);

  const sceneryById = useMemo(() => {
    const lookup = {};
    sceneryList.forEach(s => {
      lookup[s.id] = s;
    });
    return lookup;
  }, []);

  return (
    <View style={styles.background}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title} numberOfLines={1}>
          {t(currentLanguage, 'modeBuildSceneTitle')}
        </Text>
        <View style={styles.topActions}>
          <ConfirmResetButton
            currentLanguage={currentLanguage}
            onConfirm={handleReset}
            labelKey="a11yClearScene"
            confirmLabelKey="a11yClearSceneConfirm"
          />
          <NextGameButton
            currentLanguage={currentLanguage}
            onPress={handleNextGame}
          />
          <LanguageToggleButton
            currentLanguage={currentLanguage}
            onToggle={setCurrentLanguage}
          />
        </View>
      </View>

      <View
        ref={sceneRef}
        onLayout={handleSceneLayout}
        style={styles.scene}
        // Only one opaque accessible element while empty (announcing the
        // drop zone + hint) - once animals are placed, each one needs its
        // own independent accessibility label, which a single `accessible`
        // container here would otherwise swallow.
        accessible={scene.placed.length === 0}
        accessibilityLabel={t(currentLanguage, 'a11ySceneDropZone')}
      >
        <View style={styles.sky} />
        <View style={styles.ground} />

        {scene.placed.length === 0 && (
          <Text style={styles.emptyHint}>
            {t(currentLanguage, 'buildSceneEmptyHint')}
          </Text>
        )}

        {scene.placed.map(p => {
          const item =
            p.kind === 'scenery' ? sceneryById[p.itemId] : animalsById[p.itemId];
          if (!item) return null;
          return (
            <DraggableItem
              key={p.instanceId}
              item={item}
              currentLanguage={currentLanguage}
              size={PLACED_ITEM_SIZE}
              isPlaced
              left={p.x * sceneSize.width - PLACED_ITEM_SIZE / 2}
              top={p.y * sceneSize.height - PLACED_ITEM_SIZE / 2}
              hidden={drag?.key === p.instanceId}
              onTap={() => handlePlacedTap(item)}
              onDragStart={(pageX, pageY) =>
                beginDrag(p.instanceId, item, PLACED_ITEM_SIZE, pageX, pageY)
              }
              onDragMove={moveDrag}
              onDragEnd={(pageX, pageY, moved) =>
                handlePlacedDragEnd(p.instanceId, pageX, pageY, moved)
              }
            />
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.tray,
          // Pushes the whole tray bar above the floating BackToMenuButton's
          // territory - it floats at a fixed position near the screen
          // bottom, which overlaps this always-visible tray on every other
          // screen's scrollable content it was designed for.
          { marginBottom: insets.bottom + BACK_TO_MENU_CLEARANCE },
        ]}
        contentContainerStyle={styles.trayContent}
      >
        {animalList.map(animal => (
          <View key={animal.id} style={styles.trayItemWrapper}>
            <DraggableItem
              item={animal}
              currentLanguage={currentLanguage}
              size={TRAY_ITEM_SIZE}
              isPlaced={false}
              hidden={drag?.key === `tray-animal-${animal.id}`}
              onDragStart={(pageX, pageY) =>
                beginDrag(
                  `tray-animal-${animal.id}`,
                  animal,
                  TRAY_ITEM_SIZE,
                  pageX,
                  pageY
                )
              }
              onDragMove={moveDrag}
              onDragEnd={(pageX, pageY, moved) =>
                handleTrayDragEnd(animal, 'animal', pageX, pageY, moved)
              }
            />
          </View>
        ))}

        {/* A thin divider rather than a second tray row - scenery is a
            smaller, secondary set, and a second horizontally-scrolling bar
            would cost vertical space the scene area needs more. */}
        <View style={styles.trayDivider} />

        {sceneryList.map(scenery => (
          <View key={scenery.id} style={styles.trayItemWrapper}>
            <DraggableItem
              item={scenery}
              currentLanguage={currentLanguage}
              size={TRAY_ITEM_SIZE}
              isPlaced={false}
              hidden={drag?.key === `tray-scenery-${scenery.id}`}
              onDragStart={(pageX, pageY) =>
                beginDrag(
                  `tray-scenery-${scenery.id}`,
                  scenery,
                  TRAY_ITEM_SIZE,
                  pageX,
                  pageY
                )
              }
              onDragMove={moveDrag}
              onDragEnd={(pageX, pageY, moved) =>
                handleTrayDragEnd(scenery, 'scenery', pageX, pageY, moved)
              }
            />
          </View>
        ))}
      </ScrollView>

      <BackToMenuButton
        currentLanguage={currentLanguage}
        onPress={handleBackToMenu}
      />

      {/* The drag ghost - a direct child of the root view, not of the scene
          or the tray, so neither's clipping touches it. See DraggableItem's
          comment for why this exists. */}
      {drag && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              width: drag.size,
              height: drag.size,
              transform: ghostPan.getTranslateTransform(),
            },
          ]}
        >
          <LottieView
            autoPlay={false}
            loop={false}
            autoSize={false}
            resizeMode="contain"
            source={drag.item.animation_path}
            style={{ width: drag.size, height: drag.size }}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  topActions: {
    flexDirection: 'row',
    gap: 16,
  },
  scene: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: '#8ECBEE',
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: '#8FCB6B',
  },
  emptyHint: {
    position: 'absolute',
    top: '42%',
    left: 20,
    right: 20,
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  tray: {
    maxHeight: TRAY_ITEM_SIZE + 24,
    marginTop: 10,
  },
  trayContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  trayItemWrapper: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 4,
  },
  trayDivider: {
    width: 2,
    alignSelf: 'stretch',
    marginVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1,
  },
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Above everything, including the floating menu button, so a drag in
    // progress is never visually interrupted by it.
    zIndex: 100,
    elevation: 20,
  },
});
