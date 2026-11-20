import React, { memo, useEffect, useRef } from 'react';
import { FitText } from '../utility/fit-text.component';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';
import { t } from '../../constants';
import { CATEGORY_COLORS, FONTS, PALETTE, RADIUS } from '../../constants/theme';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { playClip, releasePlayer } from '../../utils/sound';
import { tapFeedback } from '../../utils/haptics';
import { WideImage } from '../utility/wide-image.component';
import { BouncyButton } from '../utility/bouncy-button.component';
import { MODES } from '../main_menu/main_menu.component.jsx';

const ANIMAL_BY_ID = Object.fromEntries(animalList.map(a => [a.id, a]));
/** The label may be wider than the disc; the disc stays centred in this room. */
const LABEL_ROOM = 1.5;
const MODE_BY_KEY = Object.fromEntries(MODES.map(m => [m.key, m]));

/** Decor drifts less than the ground it stands on, so it never outruns its page. */
const MAX_DECOR_FACTOR = 0.5;

/**
 * One full-screen world. Every layer slides sideways a little less than the
 * swipe itself, which is all it takes for flat shapes to read as depth.
 *
 * `scrollX` is the pager's animated offset (native driver), `index` this
 * page's position in it. A layer with parallax `factor` f is shifted by
 * f * (scrollX - index * width), so f = 0 travels with the page and larger
 * values lag behind it.
 */
function WorldPage({
  world,
  index,
  width,
  height,
  scrollX,
  active,
  reduceMotion,
  currentLanguage,
  landmarkSize,
  scale,
  visibleModeKeys,
  stars,
  visited,
  onLandmarkPress,
}) {
  const shift = factor =>
    reduceMotion
      ? 0
      : scrollX.interpolate({
          inputRange: [(index - 1) * width, index * width, (index + 1) * width],
          outputRange: [-factor * width, 0, factor * width],
          extrapolate: 'clamp',
        });

  const landscape = width > height;
  const colors = CATEGORY_COLORS[world.category];
  const title = t(currentLanguage, world.titleKey);

  return (
    <View style={[styles.page, { width, height, backgroundColor: world.sky }]}>
      {world.skyImage && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            {
              left: -0.1 * width,
              width: 1.2 * width,
              height,
              transform: [{ translateX: shift(0.1) }],
            },
          ]}
        >
          <WideImage
            source={world.skyImage}
            width={1.2 * width}
            height={height}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      <Animated.Image
        source={world.sun}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: height * 0.1,
          right: width * 0.1,
          width: 64 * scale,
          height: 64 * scale,
          resizeMode: 'contain',
          transform: [{ translateX: shift(0.12) }],
        }}
      />

      {world.clouds.map((c, i) => (
        <Animated.Image
          key={`cloud${i}`}
          source={c.img}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: c.x * width,
            top: c.y * height,
            width: c.w * scale,
            height: c.w * scale * 0.6,
            resizeMode: 'contain',
            opacity: 0.9,
            transform: [{ translateX: shift(0.2) }],
          }}
        />
      ))}

      {world.bands.map((band, i) => {
        const pad = band.factor * width;
        return (
          <Animated.View
            key={`band${i}`}
            pointerEvents="none"
            style={[
              styles.layer,
              {
                bottom: 0,
                left: -pad,
                width: width + 2 * pad,
                height: band.h * height,
                transform: [{ translateX: shift(band.factor) }],
              },
            ]}
          >
            <WideImage
              source={band.img}
              width={width + 2 * pad}
              height={band.h * height}
              resizeMode="stretch"
              tintColor={band.tint}
            />
          </Animated.View>
        );
      })}

      {world.decor.map((d, i) => {
        const w = d.w * scale * (landscape ? 0.8 : 1);
        return (
          <Animated.Image
            key={`decor${i}`}
            source={d.img}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: d.x * width,
              bottom: d.bottom * height,
              width: w,
              height: w * 1.4,
              resizeMode: 'contain',
              transform: [
                { translateX: shift(Math.min(d.factor, MAX_DECOR_FACTOR)) },
              ],
            }}
          />
        );
      })}

      {!landscape && world.idleAnimal && (
        <IdleAnimal
          animal={ANIMAL_BY_ID[world.idleAnimal.id]}
          size={Math.round(78 * scale)}
          left={width / 2 - Math.round(78 * scale) / 2}
          bottom={height * 0.155}
          active={active}
        />
      )}

      {/* Landmarks sit on top and travel with the page - they are what a
          child reaches for, so they never lag. */}
      {world.landmarks
        .filter(lm => visibleModeKeys.includes(lm.mode))
        .map(lm => {
          const mode = MODE_BY_KEY[lm.mode];
          const [px, py] = landscape ? lm.l : lm.p;
          const modeTitle = t(currentLanguage, mode.titleKey);
          const description = t(currentLanguage, mode.descriptionKey);
          const starCount = stars[mode.key]?.length || 0;
          return (
            <Landmark
              key={lm.mode}
              mode={mode}
              colors={colors}
              size={landmarkSize}
              scale={scale}
              left={px * width - (landmarkSize * LABEL_ROOM) / 2}
              top={py * height - landmarkSize / 2}
              active={active}
              reduceMotion={reduceMotion}
              title={modeTitle}
              starCount={starCount}
              visited={visited.includes(mode.key)}
              a11yLabel={t(currentLanguage, 'a11yModeCard', {
                title: modeTitle,
                description,
              })}
              a11yStars={
                starCount > 0
                  ? t(currentLanguage, 'a11yStarBadge', {
                      count: starCount,
                      title: modeTitle,
                    })
                  : null
              }
              onPress={onLandmarkPress}
            />
          );
        })}

      {/* Names the page for a screen reader that is reading the map. */}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={t(currentLanguage, 'a11yWorldPage', { title })}
        style={styles.srOnly}
      />
    </View>
  );
}

function Landmark({
  mode,
  colors,
  size,
  scale,
  left,
  top,
  active,
  reduceMotion,
  title,
  starCount,
  visited,
  a11yLabel,
  a11yStars,
  onPress,
}) {
  const lottie = useRef(null);
  const disc = useRef(null);

  // Pages the child can't see hold still: seven small Lotties looping
  // off-screen is battery spent on nothing.
  useEffect(() => {
    if (active && !reduceMotion) lottie.current?.play();
    else lottie.current?.pause();
  }, [active, reduceMotion]);

  const labelSize = Math.round(18 * Math.min(scale, 1.3));

  return (
    <BouncyButton
      containerStyle={{
        position: 'absolute',
        left,
        top,
        width: size * LABEL_ROOM,
        alignItems: 'center',
      }}
      style={styles.landmark}
      onPress={() =>
        // The disc's window position is where the zoom transition starts.
        disc.current
          ? disc.current.measureInWindow((x, y, width, height) =>
              onPress(mode.key, { x, y, width, height, color: colors.fill })
            )
          : onPress(mode.key)
      }
      accessible
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View
        ref={disc}
        collapsable={false}
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.fill,
            borderColor: colors.ring,
          },
        ]}
      >
        <LottieView
          ref={lottie}
          source={mode.icon}
          autoPlay={active && !reduceMotion}
          loop
          resizeMode="contain"
          autoSize={false}
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
        {visited && (
          // A paw print for places already explored - only ever a pat on
          // the back, never a mark against the ones not yet visited.
          <View style={styles.pawBadge} importantForAccessibility="no">
            <MaterialIcons name="pets" size={16} color={PALETTE.white} />
          </View>
        )}
        {starCount > 0 && (
          <View
            style={styles.starBadge}
            accessible
            accessibilityLabel={a11yStars}
          >
            <MaterialIcons name="star" size={16} color={PALETTE.ink} />
            <Text style={styles.starBadgeText}>{starCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.labelPill}>
        {/* The white fill lives on a sibling: Android clips the text of a
            view that has both a border radius and a fill, which cut long
            titles down to their first word. */}
        <View style={styles.labelBackground} importantForAccessibility="no" />
        <FitText
          style={[
            styles.label,
            { fontSize: labelSize, lineHeight: Math.round(labelSize * 1.2) },
          ]}
          maxLines={3}
          minScale={0.7}
        >
          {/* Trailing non-breaking spaces give the slanted font's last
              letter room that padding alone did not. */}
          {title}
          {'\u00A0\u00A0'}
        </FitText>
      </View>
    </BouncyButton>
  );
}

/** A small resident of the world: tap it and it moves and makes its sound. */
function IdleAnimal({ animal, left, bottom, size, active }) {
  const player = useAudioPlayer(null);
  const lottie = useRef(null);

  useEffect(() => () => releasePlayer(player), [player]);

  if (!animal) return null;

  const handlePress = () => {
    tapFeedback();
    lottie.current?.reset();
    lottie.current?.play();
    playClip(player, animal.sound);
  };

  return (
    <BouncyButton
      containerStyle={{ position: 'absolute', left, bottom }}
      onPress={handlePress}
      // Only worth a tap target while its page is the one on screen.
      disabled={!active}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        ref={lottie}
        source={animal.animation_path}
        autoPlay={false}
        loop={false}
        resizeMode="contain"
        autoSize={false}
        style={[{ width: size, height: size }, iconScaleStyle(animal)]}
      />
    </BouncyButton>
  );
}

const styles = StyleSheet.create({
  pawBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3DBE84',
    borderWidth: 2,
    borderColor: PALETTE.white,
  },
  page: { overflow: 'hidden' },
  layer: { position: 'absolute' },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  landmark: { alignItems: 'center' },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
  },
  labelPill: {
    marginTop: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  labelBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  label: {
    fontFamily: FONTS.title,
    includeFontPadding: false,
    color: PALETTE.ink,
    textAlign: 'center',
    letterSpacing: 0.5,
    // The slanted display font overhangs its last letter; without room the
    // end of a long title ("MEMORY", "ANIMAL") gets clipped.
    paddingHorizontal: 4,
  },
  starBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
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
});

export default memo(WorldPage);
