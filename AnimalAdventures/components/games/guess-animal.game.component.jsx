import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, Platform, Animated } from 'react-native';
import { Audio } from 'expo-av';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';

const MAX_LEVEL = 5;

export default function GuessAnimalGame({ currentLanguage, onBackToMenu }) {
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  const [level, setLevel] = useState(1);
  const [targetAnimal, setTargetAnimal] = useState(null);
  const [options, setOptions] = useState([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [sound, setSound] = useState(null);
  const [feedbackAnim] = useState(new Animated.Value(0));
  const [wrongCount, setWrongCount] = useState(0);
  const [showWrongOverlay, setShowWrongOverlay] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [wrongSound, setWrongSound] = useState(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

  const optionAnimRefs = useRef({});
  const wrongSoundFile = require('../../assets/sounds/background/animals/mixkit-creaking-cartoon-bird-calling-11 (online-audio-converter.com).mp3');

  const optionsCount = useMemo(() => {
    // Level 1 -> 2 options, Level 2 -> 3, ... Level 5 -> 6
    return Math.min(6, level + 1);
  }, [level]);

  const stopAndUnload = useCallback(async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
    } catch (e) {
      // no-op
    }
  }, [sound]);

  useEffect(() => {
    return () => {
      stopAndUnload();
    };
  }, [stopAndUnload]);

  useEffect(() => {
    return () => {
      try {
        if (wrongSound) {
          wrongSound.unloadAsync();
        }
      } catch (e) {}
    };
  }, [wrongSound]);

  const shuffle = useCallback(arr => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const pickRound = useCallback(() => {
    const all = shuffle(animalList);
    const nextTarget = all[0];
    const distractors = shuffle(all.slice(1)).slice(0, optionsCount - 1);
    const nextOptions = shuffle([nextTarget, ...distractors]);
    setTargetAnimal(nextTarget);
    setOptions(nextOptions);
    setIsCorrect(false);
    setShowWrongOverlay(false);
    setGameOver(false);
  }, [optionsCount, shuffle]);

  useEffect(() => {
    pickRound();
  }, [level, pickRound]);

  const playPrompt = useCallback(async () => {
    if (!targetAnimal) return;
    await stopAndUnload();
    const { sound: promptSound } = await Audio.Sound.createAsync(targetAnimal.sound);
    setSound(promptSound);
    try {
      await promptSound.replayAsync();
    } catch (e) {
      // no-op
    }
  }, [targetAnimal, stopAndUnload]);

  const onSelect = useCallback(
    async selected => {
      if (gameOver || showComplete) return;
      const correct = selected.id === targetAnimal.id;
      if (correct) {
        setIsCorrect(true);
        setWrongCount(0);
        try {
          if (optionAnimRefs.current[selected.id] && optionAnimRefs.current[selected.id].play) {
            optionAnimRefs.current[selected.id].play();
          }
        } catch (e) {}

        Animated.sequence([
          Animated.timing(feedbackAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(feedbackAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();

        setConfettiKey(prev => prev + 1);

        setTimeout(() => {
          if (level < MAX_LEVEL) {
            setLevel(prev => prev + 1);
          } else {
            setShowComplete(true);
          }
        }, 800);
      } else {
        // wrong feedback
        setShowWrongOverlay(true);
        setTimeout(() => setShowWrongOverlay(false), 900);
        try {
          const wrongAnim = optionAnimRefs.current[selected.id];
          if (wrongAnim && wrongAnim.reset) wrongAnim.reset();
        } catch (e) {}
        try {
          const { sound: w } = await Audio.Sound.createAsync(wrongSoundFile);
          setWrongSound(w);
          await w.replayAsync();
        } catch (e) {}
        setWrongCount(prev => {
          const next = prev + 1;
          if (next >= 2) {
            setGameOver(true);
          }
          return next;
        });
      }
    },
    [targetAnimal, level, feedbackAnim, wrongSoundFile, showComplete, gameOver]
  );

  const onReset = useCallback(() => {
    setLevel(1);
    setShowComplete(false);
    setWrongCount(0);
    setGameOver(false);
    setIsCorrect(false);
    pickRound();
  }, [pickRound]);

  if (!fontsLoaded) return null;

  return (
    <ImageBackground source={backgroundImage} resizeMode="cover" style={styles.backgroundImage}>
      <AmbientBackground />

      {/* Top controls */}
      <View style={styles.topBar}>
        <Text style={[styles.levelText, { fontFamily: 'Bangers_400Regular' }]}>
          {currentLanguage === 'en' ? 'Level' : 'Nivel'} {level}/{MAX_LEVEL}
        </Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={onReset} style={styles.actionButton}>
            <Text style={styles.actionText}>{currentLanguage === 'en' ? 'Reset' : 'Reiniciar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBackToMenu} style={styles.actionButton}>
            <Text style={styles.actionText}>{currentLanguage === 'en' ? 'Main Menu' : 'Menú'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Prompt */}
      <View style={styles.promptContainer}>
        <TouchableOpacity onPress={playPrompt} style={styles.promptButton}>
          <Text style={[styles.promptText, { fontFamily: 'Bangers_400Regular' }]}>
            {currentLanguage === 'en' ? 'Play Sound' : 'Reproducir Sonido'}
          </Text>
        </TouchableOpacity>
        {!!targetAnimal && (
          <Text style={styles.helperText}>
            {currentLanguage === 'en' ? 'Which animal makes this sound?' : '¿Qué animal hace este sonido?'}
          </Text>
        )}
      </View>

      {/* Options grid */}
      <View style={styles.optionsContainer}>
        {options.map(opt => (
          <TouchableOpacity key={opt.id} style={styles.optionCard} onPress={() => onSelect(opt)}>
            <View style={styles.optionInner}>
              <View style={styles.animationBackground} />
              <LottieView
                autoPlay={false}
                loop={false}
                ref={el => (optionAnimRefs.current[opt.id] = el)}
                resizeMode="contain"
                source={opt.animation_path}
                style={styles.animation}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Correct feedback + confetti */}
      {isCorrect && (
        <Animated.View
          pointerEvents="none"
          style={[styles.feedbackOverlay, { opacity: feedbackAnim }]}
        >
          <Text style={[styles.feedbackText, { fontFamily: 'Bangers_400Regular' }]}>✅</Text>
          <ConfettiCannon key={`confetti-${confettiKey}`} count={80} fadeOut={true} explosionSpeed={350} fallSpeed={3000} origin={{ x: 0, y: 0 }} />
        </Animated.View>
      )}

      {/* Wrong feedback overlay */}
      {showWrongOverlay && (
        <View pointerEvents="none" style={styles.feedbackOverlay}>
          <Text style={styles.wrongText}>✖️</Text>
        </View>
      )}

      {/* Completion overlay */}
      {showComplete && (
        <View style={styles.completionOverlay}>
          <Text style={[styles.completionTitle, { fontFamily: 'Bangers_400Regular' }]}>
            {currentLanguage === 'en' ? 'Amazing!' : '¡Increíble!'}
          </Text>
          <Text style={styles.completionSubtitle}>
            {currentLanguage === 'en' ? 'You finished all levels!' : '¡Terminaste todos los niveles!'}
          </Text>
          <ConfettiCannon key={`final-${confettiKey}-final`} count={200} fadeOut={true} explosionSpeed={300} fallSpeed={3500} origin={{ x: 0, y: 0 }} />
          <View style={styles.completionActions}>
            <TouchableOpacity onPress={onReset} style={styles.bigButton}>
              <Text style={styles.bigButtonText}>{currentLanguage === 'en' ? 'Restart' : 'Reiniciar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBackToMenu} style={styles.bigButton}>
              <Text style={styles.bigButtonText}>{currentLanguage === 'en' ? 'Main Menu' : 'Menú Principal'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Game Over overlay after two wrong attempts */}
      {gameOver && !showComplete && (
        <View style={styles.completionOverlay}>
          <Text style={[styles.completionTitle, { fontFamily: 'Bangers_400Regular', color: '#FF5252' }]}>✖️</Text>
          <Text style={styles.completionSubtitle}>
            {currentLanguage === 'en' ? 'Game Over' : 'Juego Terminado'}
          </Text>
          <View style={styles.completionActions}>
            <TouchableOpacity onPress={onReset} style={styles.bigButton}>
              <Text style={styles.bigButtonText}>{currentLanguage === 'en' ? 'Try Again' : 'Intentar de Nuevo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBackToMenu} style={styles.bigButton}>
              <Text style={styles.bigButtonText}>{currentLanguage === 'en' ? 'Main Menu' : 'Menú Principal'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#BD0000',
  },
  topBar: {
    width: '100%',
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelText: {
    color: 'white',
    fontSize: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  promptContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  promptButton: {
    backgroundColor: '#FFD700',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  promptText: {
    fontSize: 20,
    color: '#0A3D62',
    letterSpacing: 1,
  },
  helperText: {
    marginTop: 6,
    color: 'white',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 60,
  },
  optionCard: {
    width: '28%',
    height: 130,
    marginTop: '7%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: 100,
    width: '100%',
    borderRadius: 18,
    zIndex: 1,
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  animation: {
    zIndex: 2,
    width: 100,
    height: 100,
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 80,
    color: 'white',
  },
  wrongText: {
    fontSize: 120,
    color: '#FF5252',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
  },
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  completionTitle: {
    fontSize: 48,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
  },
  completionSubtitle: {
    marginTop: 8,
    fontSize: 20,
    color: '#FFD700',
  },
  completionActions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  bigButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  bigButtonText: {
    color: '#0A3D62',
    fontSize: 18,
    fontWeight: 'bold',
  },
});


