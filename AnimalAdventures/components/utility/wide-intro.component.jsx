import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { WideImage } from './wide-image.component';

/**
 * The opening scene for landscape screens and tablets.
 *
 * The phone intro is a tall 360x800 logo animation; on a wide screen it
 * floats as a small logo in a big red field. This keeps that same logo
 * animation - scaled up to fit - and builds the scene around it: red hills
 * rise from the bottom, and a few animal friends hop up to
 * say hello. Everything is laid out from the screen size, so it works in
 * either orientation.
 */

// The app icon is the logo on the splash's own red, so it also carries on
// seamlessly from the native splash screen. (The phone intro's logo
// animation is far too heavy to scale up this big.)
const LOGO = require('../../assets/icon.png');
const HILLS = require('../../assets/backgrounds/kenney/elements/hillsLarge.png');
const GROUND = require('../../assets/backgrounds/kenney/elements/groundLayer1.png');

// Where the artwork's centre sits inside the square icon.
const LOGO_CENTRE = 0.42;

const ANIMAL_BY_ID = Object.fromEntries(animalList.map(a => [a.id, a]));

// x is the animal's centre as a fraction of the screen width. They stand on
// the hills either side of the logo so they never cover it.
const FRIENDS = [
  { id: 'monkey', x: 0.1, delay: 1200 },
  { id: 'elephant', x: 0.24, delay: 1450 },
  { id: 'bear-walking', x: 0.76, delay: 1700 },
  { id: 'chicken', x: 0.9, delay: 1950 },
];

function Friend({ animal, left, bottom, size, rise }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left - size / 2,
        bottom,
        width: size,
        height: size,
        opacity: rise,
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [size * 0.8, 0],
            }),
          },
        ],
      }}
    >
      <LottieView
        source={animal.animation_path}
        autoPlay
        loop
        resizeMode="contain"
        autoSize={false}
        style={[{ width: size, height: size }, iconScaleStyle(animal)]}
      />
    </Animated.View>
  );
}

export function WideIntro({ width, height }) {
  const [hillsRise] = useState(() => new Animated.Value(0));
  const [groundRise] = useState(() => new Animated.Value(0));
  const [logoIn] = useState(() => new Animated.Value(0));
  const [rises] = useState(() => FRIENDS.map(() => new Animated.Value(0)));

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const intro = Animated.parallel([
      Animated.spring(logoIn, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(hillsRise, {
          toValue: 1,
          duration: 700,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(groundRise, {
          toValue: 1,
          duration: 700,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      ...rises.map((value, i) =>
        Animated.sequence([
          Animated.delay(FRIENDS[i].delay),
          Animated.spring(value, {
            toValue: 1,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }),
        ])
      ),
    ]);
    intro.start();
    return () => {
      intro.stop();
    };
  }, [hillsRise, groundRise, logoIn, rises]);

  const landscape = width > height;
  const logoSize = Math.min(width * 0.95, height * 1.0);
  // The artwork's centre sits a little above the middle of the screen,
  // clear of the hills.
  const logoTop = height * 0.4 - logoSize * LOGO_CENTRE;
  const friend = Math.round(Math.min(width, height) * (landscape ? 0.26 : 0.22));

  const hillHeight = height * (landscape ? 0.3 : 0.2);
  const groundHeight = height * (landscape ? 0.18 : 0.12);

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.Image
        source={LOGO}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (width - logoSize) / 2,
          top: logoTop,
          width: logoSize,
          height: logoSize,
          opacity: logoIn,
          transform: [
            {
              scale: logoIn.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        }}
      />

      <Animated.View
        style={[
          styles.band,
          {
            height: hillHeight,
            transform: [
              {
                translateY: hillsRise.interpolate({
                  inputRange: [0, 1],
                  outputRange: [hillHeight, 0],
                }),
              },
            ],
          },
        ]}
      >
        <WideImage
          source={HILLS}
          width={width}
          height={hillHeight}
          resizeMode="stretch"
          tintColor="#A40000"
        />
      </Animated.View>

      {FRIENDS.map((f, i) => (
        <Friend
          key={f.id}
          animal={ANIMAL_BY_ID[f.id]}
          left={f.x * width}
          bottom={groundHeight * 0.55}
          size={friend}
          rise={rises[i]}
        />
      ))}

      <Animated.View
        style={[
          styles.band,
          {
            height: groundHeight,
            transform: [
              {
                translateY: groundRise.interpolate({
                  inputRange: [0, 1],
                  outputRange: [groundHeight, 0],
                }),
              },
            ],
          },
        ]}
      >
        <WideImage
          source={GROUND}
          width={width}
          height={groundHeight}
          resizeMode="stretch"
          tintColor="#860000"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
