import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../constants';
import { PALETTE, RADIUS, titleText } from '../../constants/theme';
import { useResponsive } from '../../utils/use-responsive';
import { HomeButton } from './back-to-menu-button.component';
import { ConfirmResetButton } from './confirm-reset-button.component';
import { InstructionText } from './instruction-text.component';
import { LanguageToggleButton } from './language-toggle-button.component';
import { NextGameButton } from './next-game-button.component';

/**
 * The frame every activity shares: a red header band with the same controls
 * in the same places (Menu on the left; Reset, Next Game and Language on the
 * right; level and spoken instruction below), over a cream play area.
 *
 * The play area adapts to the screen's shape instead of each game doing it:
 * - Portrait: `prompt` (the animal, letter or sound button the question is
 *   about) sits above `children` (the answers), both stretching to fill the
 *   height, so a tall iPad screen is used rather than left empty.
 * - Landscape: `prompt` gets a left pane and the answers the rest, so a
 *   short, wide screen does not push the answers off the bottom.
 * Screens without a prompt get the whole area for `children`.
 *
 * Safe-area insets are handled here once. `overlay` renders above
 * everything (celebrations, "Try again!", the completion card).
 */
export function GameScreen({
  currentLanguage,
  setCurrentLanguage,
  onHome,
  onNextGame,
  onReset,
  resetLabelKey,
  resetConfirmLabelKey,
  level,
  maxLevel,
  // Short status shown in the level chip's place on screens without
  // levels, e.g. the Album's "12 / 24".
  badge,
  instruction,
  onReplayInstruction,
  prompt,
  promptPaneRatio = 0.4,
  children,
  overlay,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, contentMaxWidth } = useResponsive();
  // A wide header has room for the level and instruction inline between the
  // buttons; a phone in portrait moves them to a second row.
  const inlineHeader = isLandscape || isTablet;

  const levelChip =
    level == null && badge ? (
      <View style={styles.levelChip}>
        <Text style={styles.levelText} numberOfLines={1}>
          {badge}
        </Text>
      </View>
    ) : level != null ? (
      <View
        style={styles.levelChip}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={t(currentLanguage, 'a11yLevelStatus', {
          level,
          max: maxLevel,
        })}
      >
        <Text style={styles.levelText} numberOfLines={1}>
          {t(currentLanguage, 'level')} {level}/{maxLevel}
        </Text>
      </View>
    ) : null;

  const instructionRow = instruction ? (
    <View style={styles.instructionWrap}>
      <InstructionText
        text={instruction}
        currentLanguage={currentLanguage}
        onReplay={onReplayInstruction}
        textStyle={styles.instructionText}
      />
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.band,
          {
            paddingTop: insets.top + 8,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <View style={styles.bandRow}>
          <HomeButton currentLanguage={currentLanguage} onPress={onHome} />
          {inlineHeader ? (
            <View style={styles.inlineMiddle}>
              {levelChip}
              {instructionRow}
            </View>
          ) : (
            <View style={styles.spacer} />
          )}
          <View style={styles.actions}>
            {onReset && (
              <ConfirmResetButton
                currentLanguage={currentLanguage}
                onConfirm={onReset}
                labelKey={resetLabelKey}
                confirmLabelKey={resetConfirmLabelKey}
              />
            )}
            {onNextGame && (
              <NextGameButton
                currentLanguage={currentLanguage}
                onPress={onNextGame}
              />
            )}
            {setCurrentLanguage && (
              <LanguageToggleButton
                currentLanguage={currentLanguage}
                onToggle={setCurrentLanguage}
              />
            )}
          </View>
        </View>
        {!inlineHeader && (levelChip || instructionRow) && (
          <View style={styles.secondRow}>
            {levelChip}
            {instructionRow}
          </View>
        )}
      </View>

      <View
        style={[
          styles.play,
          {
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View
          style={[
            styles.playInner,
            { maxWidth: isLandscape ? undefined : contentMaxWidth },
            isLandscape && prompt ? styles.row : styles.column,
            contentStyle,
          ]}
        >
          {prompt ? (
            <View
              style={
                isLandscape
                  ? [
                      styles.promptPane,
                      { flexBasis: `${promptPaneRatio * 100}%` },
                    ]
                  : styles.promptTop
              }
            >
              {prompt}
            </View>
          ) : null}
          <View style={styles.answers}>{children}</View>
        </View>
      </View>

      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.cream,
  },
  band: {
    backgroundColor: PALETTE.red,
    paddingBottom: 12,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    zIndex: 1,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  spacer: {
    flex: 1,
  },
  inlineMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  actions: {
    flexDirection: 'row',
    // The established floor for adjacent controls in this app - closer
    // than this measurably caused mis-taps for small hands.
    gap: 16,
  },
  secondRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  levelChip: {
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  levelText: {
    ...titleText(20, PALETTE.ink),
  },
  instructionWrap: {
    flexShrink: 1,
  },
  instructionText: {
    fontSize: 22,
    lineHeight: 30,
  },
  play: {
    flex: 1,
    paddingTop: 16,
    alignItems: 'center',
  },
  playInner: {
    flex: 1,
    width: '100%',
  },
  column: {
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 24,
  },
  promptTop: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptPane: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answers: {
    flex: 1,
  },
});

export default GameScreen;
