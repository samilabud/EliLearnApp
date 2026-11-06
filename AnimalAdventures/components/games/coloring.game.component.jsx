import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import {
  CATEGORY_COLORS,
  PALETTE as THEME,
  RADIUS,
} from '../../constants/theme';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { useGameProgress } from '../../contexts/game-progress.context';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
import { EVENTS, track } from '../../utils/analytics';
import { tapFeedback } from '../../utils/haptics';
import { useResponsive } from '../../utils/use-responsive';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';
import { useInstructionPrompt } from '../../utils/use-instruction-prompt';

const TRAY_ITEM_SIZE = 56;
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

/**
 * The square the faint reference animal is drawn in: as large as the canvas
 * allows and centered, since the Lottie uses `contain`. New strokes are saved
 * relative to this square (see `addColorStroke`'s `unit` flag), so they stay
 * on the animal when the canvas changes shape - rotating the device used to
 * leave a finished drawing floating off to one side of it.
 */
const drawingFrame = ({ width, height }) => {
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
};

/** A saved stroke in canvas pixels, whichever units it was saved in. */
const strokeOnScreen = (stroke, frame) =>
  stroke.unit
    ? {
        points: stroke.points.map(p => ({
          x: frame.x + p.x * frame.size,
          y: frame.y + p.y * frame.size,
        })),
        width: stroke.width * frame.size,
      }
    : { points: stroke.points, width: stroke.width || STROKE_WIDTH };

export default function ColoringGame({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
  onNextGame,
}) {
  const { isLandscape, scale } = useResponsive();
  // Spoken once when the mode opens; tapping the instruction replays it.
  const { replay: replayInstruction } = useInstructionPrompt(
    'coloring',
    currentLanguage
  );
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
  const frame = useMemo(() => drawingFrame(canvasSize), [canvasSize]);
  // Latest-ref for the PanResponder, built once - see activeColorRef below.
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
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
        playVoice(
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
      const f = frameRef.current;
      if (isErasingRef.current) {
        eraseStrokesNear(
          animalIdRef.current,
          currentPointsRef.current,
          ERASE_THRESHOLD,
          f
        );
      } else if (f.size > 0) {
        addColorStroke(
          animalIdRef.current,
          activeColorRef.current,
          currentPointsRef.current.map(p => ({
            x: (p.x - f.x) / f.size,
            y: (p.y - f.y) / f.size,
          })),
          brushWidthRef.current / f.size,
          true
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
            eraseStrokesNear(
              animalIdRef.current,
              [point],
              ERASE_THRESHOLD,
              frameRef.current
            );
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
            if (
              !last ||
              Math.hypot(point.x - last.x, point.y - last.y) >=
                ERASE_LIVE_THROTTLE
            ) {
              lastErasePointRef.current = point;
              eraseStrokesNear(
                animalIdRef.current,
                [point],
                ERASE_THRESHOLD,
                frameRef.current
              );
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

  const trayItemSize = Math.round(TRAY_ITEM_SIZE * scale);

  const canvas = (
    <View
      style={styles.canvas}
      onLayout={handleCanvasLayout}
      {...(panResponder ? panResponder.panHandlers : {})}
      accessible={true}
      accessibilityLabel={t(currentLanguage, 'a11yColoringCanvas', {
        animal: animalName,
      })}
    >
      {frame.size > 0 && (
        <LottieView
          autoPlay={false}
          loop={false}
          resizeMode="contain"
          source={animal.animation_path}
          style={[
            styles.reference,
            {
              left: frame.x,
              top: frame.y,
              width: frame.size,
              height: frame.size,
            },
          ]}
          pointerEvents="none"
        />
      )}
      <Svg
        width={canvasSize.width}
        height={canvasSize.height}
        style={StyleSheet.absoluteFill}
      >
        {strokes.map((stroke, i) => {
          const onScreen = strokeOnScreen(stroke, frame);
          return (
            <Path
              key={i}
              d={toPathD(onScreen.points)}
              stroke={stroke.color}
              strokeWidth={onScreen.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}
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
  );

  const brushRow = (
    <View style={styles.brushSizes}>
      <BouncyButton
        style={[styles.toolButton, strokes.length === 0 && styles.disabled]}
        onPress={handleUndo}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: strokes.length === 0 }}
        accessibilityLabel={t(currentLanguage, 'a11yUndo')}
      >
        <MaterialIcons name="undo" size={24} color={THEME.ink} />
      </BouncyButton>
      {BRUSH_SIZES.map(({ width, key }) => (
        <BouncyButton
          key={width}
          style={[
            styles.sizeButton,
            brushWidth === width && styles.sizeButtonActive,
          ]}
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
              backgroundColor: THEME.ink,
            }}
          />
        </BouncyButton>
      ))}
    </View>
  );

  const swatches = [
    <BouncyButton
      key="eraser"
      style={[
        styles.swatch,
        styles.eraserSwatch,
        isErasing && styles.swatchActive,
      ]}
      onPress={handleToggleEraser}
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected: isErasing }}
      accessibilityLabel={t(currentLanguage, 'a11yEraser')}
    >
      <MaterialCommunityIcons name="eraser" size={22} color={THEME.ink} />
    </BouncyButton>,
    ...PALETTE.map(({ color, nameKey }) => (
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
    )),
  ];

  const tray = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tray, { maxHeight: trayItemSize + 24 }]}
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
            style={[
              { width: trayItemSize, height: trayItemSize },
              iconScaleStyle(a),
            ]}
          />
        </BouncyButton>
      ))}
    </ScrollView>
  );

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      onNextGame={handleNextGame}
      onReset={handleReset}
      resetLabelKey="a11yClearPage"
      resetConfirmLabelKey="a11yClearPageConfirm"
      instruction={t(currentLanguage, 'modeColoringDescription')}
      onReplayInstruction={replayInstruction}
    >
      {/* Portrait: tools stacked under the canvas. Landscape: tools in a
          side panel so the canvas keeps the full height. */}
      {isLandscape ? (
        <View style={styles.landscape}>
          {canvas}
          {/* Scrolls, so a very short screen can still reach every tool. */}
          <ScrollView
            style={styles.sidePanel}
            contentContainerStyle={styles.sidePanelContent}
            showsVerticalScrollIndicator={false}
          >
            {brushRow}
            <View style={styles.paletteWrap}>{swatches}</View>
            {tray}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.portrait}>
          {canvas}
          {brushRow}
          {/* One scrolling row instead of wrapping into two, so the
              drawing area keeps that height. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.paletteScroll}
            contentContainerStyle={styles.palette}
          >
            {swatches}
          </ScrollView>
          {tray}
        </View>
      )}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  portrait: {
    flex: 1,
    gap: 10,
  },
  landscape: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  sidePanel: {
    width: '46%',
    maxWidth: 460,
    flexGrow: 0,
  },
  sidePanelContent: {
    justifyContent: 'center',
    flexGrow: 1,
    gap: 12,
  },
  canvas: {
    flex: 1,
    backgroundColor: THEME.white,
    borderRadius: RADIUS.md,
    borderWidth: 4,
    borderColor: CATEGORY_COLORS.create.ring,
    overflow: 'hidden',
  },
  reference: {
    position: 'absolute',
    opacity: 0.18,
  },
  disabled: {
    opacity: 0.4,
  },
  brushSizes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // The established 16dp floor between adjacent controls.
    gap: 16,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: THEME.white,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: THEME.gold,
  },
  sizeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  sizeButtonActive: {
    borderColor: THEME.gold,
    backgroundColor: THEME.white,
  },
  paletteScroll: {
    flexGrow: 0,
  },
  palette: {
    flexDirection: 'row',
    alignItems: 'center',
    // Same 16dp minimum as brushSizes above.
    gap: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  paletteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  swatch: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 2,
    borderColor: THEME.creamDeep,
  },
  eraserSwatch: {
    backgroundColor: THEME.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 4,
    borderColor: THEME.ink,
  },
  tray: {
    flexGrow: 0,
  },
  trayContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 12,
  },
  trayItemWrapper: {
    backgroundColor: THEME.white,
    borderRadius: RADIUS.sm,
    borderWidth: 3,
    borderColor: CATEGORY_COLORS.create.fill,
    padding: 4,
  },
  trayItemActive: {
    borderColor: CATEGORY_COLORS.create.ring,
  },
});
