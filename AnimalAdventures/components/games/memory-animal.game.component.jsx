import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { AmbientBackground } from '../utility/ambient-background.component';
import { animalList } from '../animals/animal.list';
import ConfettiCannon from 'react-native-confetti-cannon';

const MAX_LEVEL = 7; // Level 1: 4 cards, Level 2: 6 cards, ..., Level 7: 16 cards
const CARD_FLIP_DELAY = 1000; // 1 second delay before flipping back unmatched cards

export default function MemoryAnimalGame({ currentLanguage, onBackToMenu }) {
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [gameComplete, setGameComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [moves, setMoves] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0); // 0 = first card, 1 = second card
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  
  // Audio players
  const cardFlipPlayer = useAudioPlayer(null);
  const matchPlayer = useAudioPlayer(null);
  const gameWinPlayer = useAudioPlayer(null);
  const gameSuccessPlayer = useAudioPlayer(null);
  
  // Animation refs
  const [confettiKey, setConfettiKey] = useState(0);
  const cardAnimRefs = useRef({});
  
  // Sound files
  const gameWinSoundFile = require('../../assets/sounds/game/game_win.mp3');
  const gameSuccessSoundFile = require('../../assets/sounds/game/game_success.mp3');
  
  const backgroundImage = require('../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg');

  // Calculate number of cards per level
  const getCardsPerLevel = useCallback((levelNum) => {
    return Math.min(2 + (levelNum * 2), 16); // Level 1: 4 cards, Level 2: 6 cards, ..., Level 7: 16 cards
  }, []);

  // Initialize game
  const initializeGame = useCallback(() => {
    const cardsPerLevel = getCardsPerLevel(level);
    const pairsNeeded = cardsPerLevel / 2;
    
    // Select random animals for the current level
    const shuffledAnimals = [...animalList].sort(() => Math.random() - 0.5);
    const selectedAnimals = shuffledAnimals.slice(0, pairsNeeded);
    
    // Create pairs
    const pairs = [...selectedAnimals, ...selectedAnimals];
    
    // Shuffle the pairs and add position info
    const shuffledPairs = pairs
      .sort(() => Math.random() - 0.5)
      .map((animal, index) => ({
        ...animal,
        position: index,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledPairs);
    setFlippedCards([]);
    setMatchedPairs([]);
    setGameComplete(false);
    setIsProcessing(false);
    setMoves(0);
    setCurrentTurn(0);
    setConfettiKey(prev => prev + 1);
  }, [level, getCardsPerLevel]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Cleanup audio players
  useEffect(() => {
    return () => {
      try {
        cardFlipPlayer.remove();
        matchPlayer.remove();
        gameWinPlayer.remove();
        gameSuccessPlayer.remove();
      } catch (e) {}
    };
  }, [cardFlipPlayer, matchPlayer, gameWinPlayer, gameSuccessPlayer]);

  // Check for level completion
  useEffect(() => {
    const cardsPerLevel = getCardsPerLevel(level);
    const pairsNeeded = cardsPerLevel / 2;
    
    if (matchedPairs.length === pairsNeeded && !gameComplete && !showLevelComplete) {
      // Level completed
      setShowLevelComplete(true);
      
      if (level < MAX_LEVEL) {
        // Move to next level after showing completion
        setTimeout(() => {
          setLevel(prevLevel => prevLevel + 1);
          setMatchedPairs([]);
          setMoves(0);
          setShowLevelComplete(false);
          setConfettiKey(prev => prev + 1);
        }, 2000);
      } else {
        // All levels completed
        setTimeout(() => {
          setGameComplete(true);
          setShowLevelComplete(false);
          // Play win sound
          try {
            gameWinPlayer.replace(gameWinSoundFile);
            gameWinPlayer.play();
          } catch (e) {}
        }, 2000);
      }
    }
  }, [matchedPairs.length, gameComplete, level, getCardsPerLevel, gameWinPlayer]);

  const playCardFlipSound = useCallback(async (animal) => {
    try {
      cardFlipPlayer.replace(animal.sound);
      cardFlipPlayer.play();
    } catch (e) {}
  }, [cardFlipPlayer]);

  const playAnimalNameSound = useCallback(async (animal) => {
    try {
      const soundFile = currentLanguage === 'en' ? animal.voice : animal.spanish_voice;
      matchPlayer.replace(soundFile);
      matchPlayer.play();
    } catch (e) {}
  }, [matchPlayer, currentLanguage]);

  const handleCardPress = useCallback(async (card) => {
    if (isProcessing || card.isFlipped || card.isMatched || flippedCards.length >= 2) {
      return;
    }

    // Play card flip sound
    await playCardFlipSound(card);

    // Flip the card
    setCards(prevCards =>
      prevCards.map(c =>
        c.position === card.position ? { ...c, isFlipped: true } : c
      )
    );

    const newFlippedCards = [...flippedCards, card];

    if (newFlippedCards.length === 1) {
      // First card flipped
      setFlippedCards(newFlippedCards);
      setCurrentTurn(1);
    } else if (newFlippedCards.length === 2) {
      // Second card flipped - check for match
      setFlippedCards(newFlippedCards);
      setIsProcessing(true);
      setMoves(prev => prev + 1);
      setCurrentTurn(0);

      const [firstCard, secondCard] = newFlippedCards;
      const isMatch = firstCard.id === secondCard.id;

      if (isMatch) {
        // Cards match
        setMatchedPairs(prev => [...prev, firstCard.id]);
        setCards(prevCards =>
          prevCards.map(c =>
            c.id === firstCard.id ? { ...c, isMatched: true } : c
          )
        );

        // Play animal name sound for match
        await playAnimalNameSound(firstCard);

        // Play success sound
        try {
          gameSuccessPlayer.replace(gameSuccessSoundFile);
          gameSuccessPlayer.play();
        } catch (e) {}

        // Trigger animation for matched cards
        try {
          if (cardAnimRefs.current[firstCard.position] && cardAnimRefs.current[firstCard.position].play) {
            cardAnimRefs.current[firstCard.position].play();
          }
          if (cardAnimRefs.current[secondCard.position] && cardAnimRefs.current[secondCard.position].play) {
            cardAnimRefs.current[secondCard.position].play();
          }
        } catch (e) {}

        // Reset flipped cards and allow another turn
        setTimeout(() => {
          setFlippedCards([]);
          setIsProcessing(false);
        }, 500);
      } else {
        // Cards don't match - flip them back after delay
        setTimeout(() => {
          setCards(prevCards =>
            prevCards.map(c =>
              newFlippedCards.some(fc => fc.position === c.position)
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setFlippedCards([]);
          setIsProcessing(false);
        }, CARD_FLIP_DELAY);
      }
    }
  }, [isProcessing, flippedCards, playCardFlipSound, playAnimalNameSound, gameSuccessPlayer]);

  const onReset = useCallback(() => {
    setLevel(1);
    setMatchedPairs([]);
    setMoves(0);
    setGameComplete(false);
    setShowLevelComplete(false);
    setConfettiKey(prev => prev + 1);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.backgroundImage}
    >
      <AmbientBackground />

      {/* Top controls */}
      <View style={styles.topBar}>
        <View style={styles.gameInfo}>
          <Text style={[styles.infoText, { fontFamily: 'Bangers_400Regular' }]}>
            {currentLanguage === 'en' ? 'Memory Game' : 'Juego de Memoria'}
          </Text>
          <Text style={styles.levelText}>
            {currentLanguage === 'en' ? 'Level' : 'Nivel'} {level}/{MAX_LEVEL}
          </Text>
          <Text style={styles.movesText}>
            {currentLanguage === 'en' ? 'Moves' : 'Movimientos'}: {moves}
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={onReset} style={styles.actionButton}>
            <Text style={styles.actionText}>
              {currentLanguage === 'en' ? 'Reset' : 'Reiniciar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBackToMenu} style={styles.actionButton}>
            <Text style={styles.actionText}>
              {currentLanguage === 'en' ? 'Main Menu' : 'Menú'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Game instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={[styles.instructionsText, { fontFamily: 'Bangers_400Regular' }]}>
          {currentLanguage === 'en'
            ? `Find matching animal pairs! (${getCardsPerLevel(level)} cards)`
            : `¡Encuentra parejas de animales! (${getCardsPerLevel(level)} cartas)`}
        </Text>
      </View>

      {/* Cards grid */}
      <View style={styles.gridContainer}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.position}
            style={styles.cardContainer}
            onPress={() => handleCardPress(card)}
            disabled={isProcessing}
          >
            <View style={styles.card}>
              {card.isFlipped || card.isMatched ? (
                <View style={styles.cardInner}>
                  <View style={styles.animationBackground} />
                  <LottieView
                    autoPlay={false}
                    loop={false}
                    ref={el => (cardAnimRefs.current[card.position] = el)}
                    resizeMode="contain"
                    source={card.animation_path}
                    style={styles.animation}
                  />
                </View>
              ) : (
                <View style={styles.cardBack}>
                  <Text style={styles.cardBackText}>?</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Level completion overlay */}
      {showLevelComplete && (
        <View style={styles.levelCompleteOverlay}>
          <Text
            style={[
              styles.levelCompleteTitle,
              { fontFamily: 'Bangers_400Regular' },
            ]}
          >
            {currentLanguage === 'en' ? 'Level Complete!' : '¡Nivel Completado!'}
          </Text>
          <Text style={styles.levelCompleteSubtitle}>
            {currentLanguage === 'en'
              ? `Moving to level ${level + 1}...`
              : `Pasando al nivel ${level + 1}...`}
          </Text>
          <ConfettiCannon
            key={`level-${level}-complete`}
            count={100}
            fadeOut={true}
            explosionSpeed={300}
            fallSpeed={3000}
            origin={{ x: 0, y: 0 }}
          />
        </View>
      )}

      {/* Game completion overlay */}
      {gameComplete && (
        <View style={styles.completionOverlay}>
          <Text
            style={[
              styles.completionTitle,
              { fontFamily: 'Bangers_400Regular' },
            ]}
          >
            {currentLanguage === 'en' ? 'Amazing!' : '¡Increíble!'}
          </Text>
          <Text style={styles.completionSubtitle}>
            {currentLanguage === 'en'
              ? 'You completed all memory levels!'
              : '¡Completaste todos los niveles de memoria!'}
          </Text>
          <ConfettiCannon
            key={`memory-${confettiKey}-complete`}
            count={200}
            fadeOut={true}
            explosionSpeed={300}
            fallSpeed={3500}
            origin={{ x: 0, y: 0 }}
          />
          <View style={styles.completionActions}>
            <TouchableOpacity onPress={onReset} style={styles.bigButton}>
              <Text style={styles.bigButtonText}>
                {currentLanguage === 'en' ? 'Play Again' : 'Jugar de Nuevo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onBackToMenu}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {currentLanguage === 'en' ? 'Main Menu' : 'Menú Principal'}
              </Text>
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
    paddingTop: 34,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameInfo: {
    flex: 1,
  },
  infoText: {
    color: 'white',
    fontSize: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 3 },
    paddingBottom: 4,
  },
  levelText: {
    color: 'white',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
    paddingBottom: 4,
  },
  movesText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
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
  instructionsContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'space-around',
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: '22%',
    height: 100,
    marginBottom: 8,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: '100%',
    width: '100%',
    borderRadius: 12,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  animation: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  cardBack: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  cardBackText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0A3D62',
  },
  levelCompleteOverlay: {
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
  levelCompleteTitle: {
    fontSize: 42,
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 4 },
    textAlign: 'center',
    marginBottom: 16,
  },
  levelCompleteSubtitle: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
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
    textAlign: 'center',
  },
  completionSubtitle: {
    marginTop: 8,
    fontSize: 18,
    color: '#FFD700',
    textAlign: 'center',
    lineHeight: 24,
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
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  secondaryButtonText: {
    color: '#0A3D62',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
