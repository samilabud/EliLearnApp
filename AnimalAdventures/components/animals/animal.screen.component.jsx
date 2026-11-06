import React, { useRef, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { animalList, iconScaleStyle } from './animal.list';
import { t } from '../../constants';
import { FONTS, PALETTE } from '../../constants/theme';
import { gridColumns, useResponsive } from '../../utils/use-responsive';
import { tapFeedback } from '../../utils/haptics';
import { EVENTS, track } from '../../utils/analytics';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
import { useGameProgress } from '../../contexts/game-progress.context';
import { AnswerCard } from '../utility/answer-card.component';

const CARD_GAP = 16;
// Narrowest a card gets before the grid drops a column - grown with the
// device scale so an iPad shows bigger animals, not just more of them.
const MIN_CARD_WIDTH = 104;

const AnimalScreen = ({ currentLanguage }) => {
  const { scale } = useResponsive();
  const soundPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const { markAnimalMet } = useGameProgress();
  const [currentAnimation, setCurrentAnimation] = useState();

  // Columns come from the width this grid actually has, so a phone shows
  // three, a landscape phone or iPad more, and cards stay square-ish
  // instead of stretching into slabs.
  const [areaWidth, setAreaWidth] = useState(0);
  const columns = gridColumns(
    areaWidth,
    MIN_CARD_WIDTH * scale,
    CARD_GAP,
    3,
    8
  );
  const cardWidth = Math.floor(
    (areaWidth - CARD_GAP * (columns - 1)) / columns
  );

  const animRef = useRef([]);

  const resetAndPlayAnim = (playCurrent, soundUrl, voiceUrl, animalId) => {
    tapFeedback();
    track(EVENTS.ANIMAL_VIEWED, { animal: animalId });
    // Hearing an animal counts as meeting it, so Learn fills the album too.
    markAnimalMet(animalId, 'learn');
    if (currentAnimation && typeof currentAnimation.reset === 'function') {
      try {
        currentAnimation.reset();
      } catch {
        // no-op
      }
    }
    setCurrentAnimation(playCurrent);
    playSound(soundUrl, voiceUrl);
    delay(200).then(() => {
      if (playCurrent && typeof playCurrent.play === 'function') {
        try {
          playCurrent.play();
        } catch {
          // no-op
        }
      }
    });
  };
  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }
  function playSound(soundFile, voiceFile) {
    playVoice(voicePlayer, voiceFile);
    delay(1000).then(() => playClip(soundPlayer, soundFile));
  }

  useEffect(() => {
    return () => {
      releasePlayer(soundPlayer);
      releasePlayer(voicePlayer);
    };
  }, [soundPlayer, voicePlayer]);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      onLayout={e => setAreaWidth(e.nativeEvent.layout.width)}
    >
      {areaWidth > 0 && (
        <View style={[styles.grid, { gap: CARD_GAP }]}>
          {animalList.map(animal => {
            const name =
              currentLanguage === 'en' ? animal.name : animal.spanish_name;
            return (
              <View
                key={`${animal.name}-animatedImage`}
                style={{ width: cardWidth, height: cardWidth * 1.2 }}
              >
                <AnswerCard
                  category="listen"
                  onPress={() =>
                    resetAndPlayAnim(
                      animRef.current[animal.name],
                      animal.sound,
                      currentLanguage === 'en'
                        ? animal.voice
                        : animal.spanish_voice,
                      animal.id
                    )
                  }
                  accessibilityLabel={t(currentLanguage, 'a11yAnimalCard', {
                    animal: name,
                  })}
                >
                  <LottieView
                    autoPlay={false}
                    autoSize={false}
                    ref={el => (animRef.current[animal.name] = el)}
                    resizeMode="contain"
                    loop={false}
                    source={animal.animation_path}
                    style={[
                      { width: cardWidth * 0.8, height: cardWidth * 0.8 },
                      iconScaleStyle(animal),
                    ]}
                  />
                  <Text
                    style={[
                      styles.animationName,
                      {
                        fontSize: 18 * scale,
                        lineHeight: Math.round(24 * scale),
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    accessible={false}
                  >
                    {name}
                  </Text>
                </AnswerCard>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  animationName: {
    fontFamily: FONTS.title,
    // Bangers clips on Android without this - see
    // first-letter.game.component.jsx for the full explanation.
    includeFontPadding: false,
    letterSpacing: 1,
    color: PALETTE.ink,
    paddingHorizontal: 6,
  },
});
export default AnimalScreen;
