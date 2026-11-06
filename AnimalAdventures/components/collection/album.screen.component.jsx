import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import LottieView from 'lottie-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { animalList, iconScaleStyle } from '../animals/animal.list';
import { MODES } from '../main_menu/main_menu.component.jsx';
import { t } from '../../constants';
import {
  CATEGORY_COLORS,
  FONTS,
  PALETTE,
  RADIUS,
  titleText,
} from '../../constants/theme';
import { gridColumns, useResponsive } from '../../utils/use-responsive';
import { tapFeedback } from '../../utils/haptics';
import { useBackToMenu } from '../../utils/navigation';
import { playClip, releasePlayer, playVoice } from '../../utils/sound';
import { useGameProgress } from '../../contexts/game-progress.context';
import { BouncyButton } from '../utility/bouncy-button.component';
import { GameScreen } from '../utility/game-screen.component';

const CARD_GAP = 16;
// Narrowest a card gets before the grid drops a column; grown with the
// device scale so an iPad shows bigger animals, not just more of them.
const MIN_CARD_WIDTH = 104;

/**
 * Every animal in the app, shown as met or not yet met.
 *
 * Nothing here is locked and nothing is ever taken away - the board only
 * fills up. That is the whole mechanic: a set a child can complete, using
 * artwork the app already ships rather than new assets.
 */
export default function AlbumScreen({
  currentLanguage,
  setCurrentLanguage,
  onBackToMenu,
}) {
  const { scale } = useResponsive();
  const { met, metVia, stars } = useGameProgress();
  // Only the leveled games earn stars - 'learn' and 'album' have no level
  // concept, so they're naturally absent from `stars` and skipped here.
  const starGames = useMemo(
    () => MODES.filter(mode => mode.key in stars),
    [stars]
  );
  const animPlayer = useAudioPlayer(null);
  const voicePlayer = useAudioPlayer(null);
  const animRefs = useRef({});
  const voiceTimer = useRef(null);

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
  const boxSize = cardWidth;
  const shelfItemSize = Math.round(72 * scale);

  const metSet = useMemo(() => new Set(met), [met]);

  const handleBackToMenu = useCallback(() => {
    tapFeedback();
    onBackToMenu();
  }, [onBackToMenu]);

  useBackToMenu(handleBackToMenu);

  React.useEffect(() => {
    return () => {
      releasePlayer(animPlayer);
      releasePlayer(voicePlayer);
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    };
  }, [animPlayer, voicePlayer]);

  const handlePress = useCallback(
    animal => {
      if (!metSet.has(animal.id)) return;
      tapFeedback();
      const ref = animRefs.current[animal.id];
      if (ref && ref.play) {
        try {
          ref.reset();
          ref.play();
        } catch {
          // Animation handle went away with a re-render.
        }
      }
      playClip(animPlayer, animal.sound);
      // Staggered rather than simultaneous, so the animal's sound and its
      // spoken name don't talk over each other - same delay the Learn
      // screen uses for the same pairing.
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => {
        playVoice(
          voicePlayer,
          currentLanguage === 'en' ? animal.voice : animal.spanish_voice
        );
      }, 1000);
    },
    [metSet, animPlayer, voicePlayer, currentLanguage]
  );

  return (
    <GameScreen
      currentLanguage={currentLanguage}
      setCurrentLanguage={setCurrentLanguage}
      onHome={handleBackToMenu}
      badge={t(currentLanguage, 'albumProgress', {
        met: metSet.size,
        total: animalList.length,
      })}
    >
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        onLayout={e => setAreaWidth(e.nativeEvent.layout.width)}
      >
        {metSet.size === 0 && (
          <Text style={styles.hint}>
            {t(currentLanguage, 'albumHintEmpty')}
          </Text>
        )}

        <Text style={styles.sectionTitle}>
          {t(currentLanguage, 'starsShelfTitle')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.starsShelf}
        >
          {starGames.map(mode => {
            const count = stars[mode.key]?.length || 0;
            const title = t(currentLanguage, mode.titleKey);
            return (
              <View
                key={mode.key}
                style={[
                  styles.starsShelfItem,
                  { width: shelfItemSize, height: shelfItemSize },
                ]}
                accessible={true}
                accessibilityLabel={t(currentLanguage, 'a11yStarBadge', {
                  count,
                  title,
                })}
              >
                <LottieView
                  autoPlay
                  loop
                  autoSize={false}
                  resizeMode="contain"
                  source={mode.icon}
                  style={{
                    width: shelfItemSize * 0.6,
                    height: shelfItemSize * 0.6,
                  }}
                />
                <View style={styles.starsShelfCount}>
                  <MaterialIcons name="star" size={14} color={PALETTE.ink} />
                  <Text style={styles.starsShelfCountText}>{count}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {areaWidth > 0 && (
          <View style={[styles.grid, { gap: CARD_GAP }]}>
            {animalList.map(animal => {
              const isMet = metSet.has(animal.id);
              const name =
                currentLanguage === 'en' ? animal.name : animal.spanish_name;
              // Absent for an animal met before this slice existed, or (in
              // principle) an unrecognized game key from a future build -
              // both just mean no badge rather than a broken one.
              const sourceKey = metVia[animal.id];
              const sourceMode = MODES.find(m => m.key === sourceKey);
              const sourceTitle = sourceMode
                ? t(currentLanguage, sourceMode.titleKey)
                : null;

              return (
                <BouncyButton
                  key={animal.id}
                  style={{ width: cardWidth }}
                  onPress={() => handlePress(animal)}
                  disabled={!isMet}
                  accessible
                  accessibilityRole={isMet ? 'button' : 'image'}
                  accessibilityLabel={
                    isMet
                      ? sourceTitle
                        ? t(currentLanguage, 'a11yAlbumAnimalMetVia', {
                            animal: name,
                            game: sourceTitle,
                          })
                        : t(currentLanguage, 'a11yAlbumAnimal', {
                            animal: name,
                          })
                      : t(currentLanguage, 'a11yAlbumLocked')
                  }
                >
                  {/* Met and unmet cards share one geometry, so every row
                      lines up regardless of which animals are filled in. */}
                  <View
                    style={[
                      styles.box,
                      { height: boxSize },
                      isMet ? styles.boxMet : styles.boxLocked,
                    ]}
                  >
                    {isMet ? (
                      <LottieView
                        autoPlay={false}
                        loop={false}
                        autoSize={false}
                        ref={el => (animRefs.current[animal.id] = el)}
                        resizeMode="contain"
                        source={animal.animation_path}
                        style={[
                          { width: boxSize * 0.82, height: boxSize * 0.82 },
                          iconScaleStyle(animal),
                        ]}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.lockedMark,
                          { fontSize: boxSize * 0.35 },
                        ]}
                      >
                        ?
                      </Text>
                    )}
                    {isMet && sourceMode && (
                      <View style={styles.sourceBadge}>
                        <MaterialIcons
                          name={sourceMode.glyph}
                          size={14}
                          color="white"
                        />
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.label,
                      isMet ? styles.labelMet : styles.labelLocked,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {isMet ? name : t(currentLanguage, 'notMetYet')}
                  </Text>
                </BouncyButton>
              );
            })}
          </View>
        )}
      </ScrollView>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  hint: {
    ...titleText(22, PALETTE.ink),
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...titleText(22, PALETTE.red),
  },
  starsShelf: {
    gap: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  starsShelfItem: {
    borderRadius: RADIUS.sm,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: PALETTE.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsShelfCount: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: PALETTE.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  starsShelfCountText: {
    fontFamily: FONTS.bodyHeavy,
    color: PALETTE.ink,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  box: {
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxMet: {
    backgroundColor: PALETTE.white,
    borderColor: CATEGORY_COLORS.listen.ring,
  },
  boxLocked: {
    backgroundColor: PALETTE.creamDeep,
    borderColor: 'rgba(10, 61, 98, 0.15)',
    borderStyle: 'dashed',
  },
  sourceBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PALETTE.ink,
    borderWidth: 1.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMark: {
    fontWeight: 'bold',
    color: 'rgba(10, 61, 98, 0.35)',
  },
  label: {
    marginTop: 6,
    textAlign: 'center',
  },
  labelMet: {
    ...titleText(18, PALETTE.ink),
  },
  labelLocked: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: PALETTE.inkSoft,
  },
});
