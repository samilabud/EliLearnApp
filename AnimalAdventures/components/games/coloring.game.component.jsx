import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { animalList } from '../animals/animal.list';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import { tapFeedback } from '../../utils/haptics';
import { AmbientBackground } from '../utility/ambient-background.component';
import { BouncyButton } from '../utility/bouncy-button.component';
import { LanguageToggleButton } from '../utility/language-toggle-button.component';
import { NextGameButton } from '../utility/next-game-button.component';
import {
  BackToMenuButton,
  BACK_TO_MENU_CLEARANCE,
} from '../utility/back-to-menu-button.component';
import { ConfirmResetButton } from '../utility/confirm-reset-button.component';

const TRAY_ITEM_SIZE = 64;
const STROKE_WIDTH = 14;

// How close (canvas px) an eraser pass has to come to a stroke's own points
// to delete it. Also doubles as the live eraser-preview's own stroke width,
// so what's drawn on screen while erasing matches what will actually be
// touched.
const ERASE_THRESHOLD = 26;

// How far (canvas px) the finger has to travel while erasing before the
// next live erase check runs. Erasing on every single move event would
// mean a context update (and a real re-render) that often - this keeps
// strokes disappearing smoothly as the eraser passes over them without
// checking far more often than the finger could possibly have reached a
// new stroke.
const ERASE_LIVE_THROTTLE = 14;

const BRUSH_SIZES = [
  { width: 8, key: 'brushSizeSmall' },
  { width: 14, key: 'brushSizeMedium' },
  { width: 22, key: 'brushSizeLarge' },
];

const PALETTE = [
  { color: '#E74C3C', nameKey: 'colorRed' },
  { color: '#F39C12', nameKey: 'colorOrange' },
  { color: '#F1C40F', nameKey: 'colorYellow' },
  { color: '#2ECC71', nameKey: 'colorGreen' },
  { color: '#3498DB', nameKey: 'colorBlue' },
  { color: '#9B59B6', nameKey: 'colorPurple' },
  { color: '#FF6FA5', nameKey: 'colorPink' },
  { color: '#8B5E3C', nameKey: 'colorBrown' },
  { color: '#2C2C2C', nameKey: 'colorBlack' },
  { color: '#FFFFFF', nameKey: 'colorWhite' },
];

/** `points` (plain {x,y} pairs, in canvas-local coordinates) to an SVG path
 * string - identical in spirit to trace-letter.game.component.jsx's
 * `pathD` reduce, just without that file's "move" flag since every call
 * here is already one single continuous stroke. */
const toPathD = points =>
  points.reduce(
    (acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y} ` : `L ${p.x} ${p.y} `),
    ''
  );

export default function ColoringGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
  ambientEnabled,
}) {
  const insets = useSafeAreaInsets();
  const {
    coloring,
    addColorStroke,
    undoLastStroke,
    eraseStrokesNear,
    clearColorPage,
    markAnimalMet,
  } = useGameProgress();

  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const voiceTimer = useRef(null);
  // One per tray thumbnail, so a tap can play just that one - see
  // handleSelectAnimal. Every tray Lottie used to autoPlay/loop at once,
  // which was the actual source of this screen running slow on a real
  // device with 24+ of them animating simultaneously.
  const lottieRefs = useRef({});

  const [animalId, setAnimalId] = useState(animalList[0].id);
  const animal = useMemo(
    () => animalList.find(a => a.id === animalId) || animalList[0],
    [animalId]
  );

  const [activeColor, setActiveColor] = useState(PALETTE[0].color);
  const [brushWidth, setBrushWidth] = useState(BRUSH_SIZES[1].width);
  const [isErasing, setIsErasing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const handleCanvasLayout = useCallback(e => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  // The in-progress stroke is driven almost entirely outside React state.
  // `isDrawing` only mounts/unmounts the live-preview Path (one render at
  // the start and end of a stroke); while a gesture is in progress, its
  // `d` is pushed straight to the native view via setNativeProps on every
  // move event instead of through setState - going through React/setState
  // on every touch-move re-rendered this whole screen (strokes already
  // drawn, the 24-item tray, the palette) dozens of times a second, which
  // is what made a line visibly lag behind the finger. See livePathRef.
  const [isDrawing, setIsDrawing] = useState(false);
  // The live Path's `d` at the moment it mounts - just the single starting
  // point, read from state (not the ref) because React forbids reading a
  // ref's value during render. Every point after this one updates the
  // native node directly via setNativeProps instead.
  const [startD, setStartD] = useState('');
  const currentPointsRef = useRef([]);
  const livePathRef = useRef(null);
  // Throttles live erasing - see ERASE_LIVE_THROTTLE.
  const lastErasePointRef = useRef(null);
  // Latest-ref set so the PanResponder (built once below) always commits
  // against whatever's on screen *at release time*, not whichever was
  // active when the responder was created - same reasoning as the
  // latest-ref dance in build-scene.game.component.jsx's DraggableItem.
  const activeColorRef = useRef(activeColor);
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  const brushWidthRef = useRef(brushWidth);
  useEffect(() => {
    brushWidthRef.current = brushWidth;
  }, [brushWidth]);
  const isErasingRef = useRef(isErasing);
  useEffect(() => {
    isErasingRef.current = isErasing;
  }, [isErasing]);
  const animalIdRef = useRef(animalId);
  useEffect(() => {
    animalIdRef.current = animalId;
  }, [animalId]);

  useEffect(() => {
    const hasAnyPage = Object.keys(coloring.pages).length > 0;
    track(hasAnyPage ? EVENTS.GAME_RESUMED : EVENTS.GAME_STARTED, {
      game: 'coloring',
    });
    // Fires once per visit to the screen, not once per stroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      releasePlayer(soundPlayer);
      releasePlayer(voicePlayer);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [soundPlayer, voicePlayer]);

  const playAnimal = useCallback(
    a => {
      if (!a.sound) return;
      playClip(soundPlayer, a.sound);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => {
        playClip(
          voicePlayer,
          currentLanguage === 'en' ? a.voice : a.spanish_voice
        );
      }, 1000);
    },
    [soundPlayer, voicePlayer, currentLanguage]
  );

  // Finishes a stroke: commits paint (addColorStroke) or does a final
  // erase pass over the whole gesture as a safety net for anything the
  // throttled live erasing in onPanResponderMove below might have missed.
  const finishStroke = useCallback(() => {
    if (currentPointsRef.current.length > 1) {
      if (isErasingRef.current) {
        eraseStrokesNear(
          animalIdRef.current,
          currentPointsRef.current,
          ERASE_THRESHOLD
        );
      } else {
        addColorStroke(
          animalIdRef.current,
          activeColorRef.current,
          currentPointsRef.current,
          brushWidthRef.current
        );
      }
    }
    currentPointsRef.current = [];
    lastErasePointRef.current = null;
    setIsDrawing(false);
  }, [addColorStroke, eraseStrokesNear]);

  // Latest-ref so the PanResponder (built once below) always commits
  // against the current animal/color, not whichever was active when it was
  // created - same "latest ref" dance build-scene.game.component.jsx's
  // DraggableItem uses for its onTap/onDragStart/etc. callbacks.
  const finishStrokeRef = useRef(finishStroke);
  useEffect(() => {
    finishStrokeRef.current = finishStroke;
  }, [finishStroke]);

  const [panResponder, setPanResponder] = useState(null);
  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };
          currentPointsRef.current = [point];
          // Mounts the live-preview Path for this gesture, starting at
          // this first point - every point after this one is pushed via
          // setNativeProps in onPanResponderMove instead.
          setStartD(toPathD([point]));
          setIsDrawing(true);
          if (isErasingRef.current) {
            lastErasePointRef.current = point;
            eraseStrokesNear(animalIdRef.current, [point], ERASE_THRESHOLD);
          }
        },
        onPanResponderMove: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          const point = { x: locationX, y: locationY };
          currentPointsRef.current = [...currentPointsRef.current, point];
          // Bypasses React/setState entirely for the hot path - pushing a
          // new `d` straight to the native SVG node every move event, so
          // the line tracks the finger with no render-driven lag.
          livePathRef.current?.setNativeProps({
            d: toPathD(currentPointsRef.current),
          });
          if (isErasingRef.current) {
            const last = lastErasePointRef.current;
            if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= ERASE_LIVE_THROTTLE) {
              lastErasePointRef.current = point;
              eraseStrokesNear(animalIdRef.current, [point], ERASE_THRESHOLD);
            }
          }
        },
        onPanResponderRelease: () => finishStrokeRef.current(),
        onPanResponderTerminate: () => finishStrokeRef.current(),
      })
    );
    // Built once per mount - the latest-refs above are what keep its
    // callbacks fresh, not recreating it. eraseStrokesNear is stable
    // (useCallback with an empty dep array in the context), safe to close
    // over directly rather than through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectAnimal = useCallback(
    a => {
      tapFeedback();
      setAnimalId(a.id);
      markAnimalMet(a.id, 'coloring');
      playAnimal(a);
      lottieRefs.current[a.id]?.play();
    },
    [markAnimalMet, playAnimal]
  );

  const handleSelectColor = useCallback(color => {
    tapFeedback();
    setActiveColor(color);
    setIsErasing(false);
  }, []);

  const handleToggleEraser = useCallback(() => {
    tapFeedback();
    setIsErasing(prev => !prev);
  }, []);

  const handleSelectBrushSize = useCallback(width => {
    tapFeedback();
    setBrushWidth(width);
  }, []);

  const strokes = coloring.pages[animalId]?.strokes || [];

  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    tapFeedback();
    undoLastStroke(animalId);
  }, [undoLastStroke, animalId, strokes.length]);

  const handleReset = useCallback(() => {
    track(EVENTS.GAME_RESET, { game: 'coloring' });
    clearColorPage(animalId);
  }, [clearColorPage, animalId]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    onBackToMenu();
  }, [onBackToMenu]);

  useBackToMenu(handleBackToMenu);

  const handleNextGame = useCallback(() => {
    tapFeedback();
    onNextGame();
  }, [onNextGame]);

  const animalName =
    currentLanguage === 'en' ? animal.name : animal.spanish_name;

  return (
    <View style={styles.background}>
      {ambientEnabled && <AmbientBackground />}

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title} numberOfLines={1}>
          {t(currentLanguage, 'modeColoringTitle')}
        </Text>
        <View style={styles.topActions}>
          <BouncyButton
            style={[styles.undoButton, strokes.length === 0 && styles.disabled]}
            onPress={handleUndo}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: strokes.length === 0 }}
            accessibilityLabel={t(currentLanguage, 'a11yUndo')}
          >
            <MaterialIcons name="undo" size={22} color="#0A3D62" />
          </BouncyButton>
          <ConfirmResetButton
            currentLanguage={currentLanguage}
            onConfirm={handleReset}
            labelKey="a11yClearPage"
            confirmLabelKey="a11yClearPageConfirm"
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

      <View style={styles.canvasWrapper}>
        <View
          style={styles.canvas}
          onLayout={handleCanvasLayout}
          {...(panResponder ? panResponder.panHandlers : {})}
          accessible={true}
          accessibilityLabel={t(currentLanguage, 'a11yColoringCanvas', {
            animal: animalName,
          })}
        >
          {canvasSize.width > 0 && (
            <LottieView
              autoPlay={false}
              loop={false}
              resizeMode="contain"
              source={animal.animation_path}
              style={[StyleSheet.absoluteFill, styles.reference]}
              pointerEvents="none"
            />
          )}
          <Svg
            width={canvasSize.width}
            height={canvasSize.height}
            style={StyleSheet.absoluteFill}
          >
            {strokes.map((s, i) => (
              <Path
                key={i}
                d={toPathD(s.points)}
                stroke={s.color}
                strokeWidth={s.width || STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {isDrawing && (
              <Path
                ref={livePathRef}
                // Only the starting point at mount time - every point
                // after this is pushed straight to the native node via
                // setNativeProps in onPanResponderMove, not through this
                // prop, so re-renders don't gate how fast the line grows.
                d={startD}
                stroke={isErasing ? '#999999' : activeColor}
                strokeWidth={isErasing ? ERASE_THRESHOLD : brushWidth}
                strokeDasharray={isErasing ? '2,10' : undefined}
                strokeOpacity={isErasing ? 0.5 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
        </View>
      </View>

      <View style={styles.brushSizes}>
        {BRUSH_SIZES.map(({ width, key }) => (
          <BouncyButton
            key={width}
            style={[styles.sizeButton, brushWidth === width && styles.sizeButtonActive]}
            onPress={() => handleSelectBrushSize(width)}
            accessible
            accessibilityRole="button"
            accessibilityState={{ selected: brushWidth === width }}
            accessibilityLabel={t(currentLanguage, 'a11yBrushSize', {
              size: t(currentLanguage, key),
            })}
          >
            <View
              style={{
                width: width + 6,
                height: width + 6,
                borderRadius: (width + 6) / 2,
                backgroundColor: '#0A3D62',
              }}
            />
          </BouncyButton>
        ))}
      </View>

      <View style={styles.palette}>
        <BouncyButton
          style={[styles.swatch, styles.eraserSwatch, isErasing && styles.swatchActive]}
          onPress={handleToggleEraser}
          accessible
          accessibilityRole="button"
          accessibilityState={{ selected: isErasing }}
          accessibilityLabel={t(currentLanguage, 'a11yEraser')}
        >
          <MaterialCommunityIcons name="eraser" size={22} color="#0A3D62" />
        </BouncyButton>
        {PALETTE.map(({ color, nameKey }) => (
          <BouncyButton
            key={color}
            style={[
              styles.swatch,
              { backgroundColor: color },
              !isErasing && activeColor === color && styles.swatchActive,
            ]}
            onPress={() => handleSelectColor(color)}
            accessible
            accessibilityRole="button"
            accessibilityState={{ selected: !isErasing && activeColor === color }}
            accessibilityLabel={t(currentLanguage, 'a11yColorSwatch', {
              color: t(currentLanguage, nameKey),
            })}
          />
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.tray,
          { marginBottom: insets.bottom + BACK_TO_MENU_CLEARANCE },
        ]}
        contentContainerStyle={styles.trayContent}
      >
        {animalList.map(a => (
          <BouncyButton
            key={a.id}
            style={[
              styles.trayItemWrapper,
              a.id === animalId && styles.trayItemActive,
            ]}
            onPress={() => handleSelectAnimal(a)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yColoringAnimal', {
              animal: currentLanguage === 'en' ? a.name : a.spanish_name,
            })}
          >
            <LottieView
              ref={r => {
                lottieRefs.current[a.id] = r;
              }}
              autoPlay={false}
              loop={false}
              resizeMode="contain"
              source={a.animation_path}
              style={{ width: TRAY_ITEM_SIZE, height: TRAY_ITEM_SIZE }}
            />
          </BouncyButton>
        ))}
      </ScrollView>

      <BackToMenuButton
        currentLanguage={currentLanguage}
        onPress={handleBackToMenu}
      />
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
  undoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  disabled: {
    opacity: 0.4,
  },
  canvasWrapper: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFD700',
    overflow: 'hidden',
  },
  reference: {
    opacity: 0.18,
  },
  brushSizes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // Matches the 16dp minimum this app settled on everywhere else after
    // finding smaller gaps risked mis-taps for this audience (see
    // guess-animal.game.component.jsx's topActions comment) - this row
    // hadn't been brought in line with that yet.
    gap: 16,
    paddingTop: 10,
  },
  sizeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sizeButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // Same 16dp-minimum reasoning as brushSizes above - 11 adjacent
    // swatches (eraser + 10 colors) at the old 10dp gap was tighter than
    // this app's own established standard for small hands.
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  swatch: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  eraserSwatch: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: '#0A3D62',
  },
  tray: {
    maxHeight: TRAY_ITEM_SIZE + 24,
    marginTop: 4,
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
  trayItemActive: {
    borderColor: '#0A3D62',
  },
});
