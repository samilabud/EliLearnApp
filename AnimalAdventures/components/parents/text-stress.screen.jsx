import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../constants';
import { FONTS, PALETTE, RADIUS, titleText } from '../../constants/theme';
import { FitText } from '../utility/fit-text.component';
import { MODES } from '../main_menu/main_menu.component.jsx';

/**
 * Developer screen: every child-facing title and label in the app, laid out
 * in boxes as narrow as the real ones, so a cut-off word is obvious at a
 * glance. Open it from the parent area by long-pressing the version line.
 *
 * Use it with the system font size at its largest, on a ~360 pt phone, in
 * both languages. "Extra long" appends extra words to every string to
 * simulate copy that is longer than today's. Nothing should ever be hidden:
 * a label may shrink or grow taller, but every word must stay visible.
 */

const WORLD_TITLE_KEYS = [
  'categoryListen',
  'categoryLetters',
  'categoryMemory',
  'categoryCreate',
];

const EXTRA = { en: ' With Extra Words', es: ' Con Palabras Extra' };

export default function TextStressScreen({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState('es');
  const [extra, setExtra] = useState(false);

  const str = key => t(lang, key) + (extra ? EXTRA[lang] : '');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <Toggle
            label={`Language: ${lang}`}
            onPress={() => setLang(lang === 'en' ? 'es' : 'en')}
          />
          <Toggle
            label={`Extra long: ${extra ? 'on' : 'off'}`}
            onPress={() => setExtra(!extra)}
          />
          <Toggle label="Close" onPress={onClose} />
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            gap: 20,
          }}
        >
          <Section title="World map landmark labels (18 pt, 165 pt wide)">
            <View style={styles.wrap}>
              {MODES.map(mode => (
                <View key={mode.key} style={[styles.box, { width: 165 }]}>
                  <View style={styles.pill}>
                    <View style={styles.pillFill} />
                    <FitText
                      style={styles.worldLabel}
                      maxLines={3}
                      minScale={0.7}
                    >
                      {str(mode.titleKey) + '  '}
                    </FitText>
                  </View>
                </View>
              ))}
            </View>
          </Section>

          <Section title="World titles (26 pt, 200 pt wide)">
            {WORLD_TITLE_KEYS.map(key => (
              <View key={key} style={[styles.box, { width: 200 }]}>
                <FitText style={styles.worldTitle} maxLines={2} minScale={0.7}>
                  {str(key)}
                </FitText>
              </View>
            ))}
          </Section>

          <Section title="Menu tile titles (20 pt, 150 pt wide)">
            <View style={styles.wrap}>
              {MODES.map(mode => (
                <View key={mode.key} style={[styles.box, { width: 150 }]}>
                  <FitText
                    style={styles.tileTitle}
                    maxLines={3}
                    minScale={0.75}
                  >
                    {str(mode.titleKey)}
                  </FitText>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Game header: level chip + buttons (narrow row)">
            <View
              style={[styles.box, { width: 130, backgroundColor: PALETTE.red }]}
            >
              <View style={styles.chip}>
                <View style={styles.chipFill} />
                <FitText style={styles.chipText} maxLines={2} minScale={0.7}>
                  {`${str('level')} 3/8`}
                </FitText>
              </View>
            </View>
          </Section>

          <Section title="Play / hear buttons (26 pt, 200 pt wide)">
            {['playSound', 'playName', 'bandPlaySong'].map(key => (
              <View key={key} style={[styles.box, { width: 200 }]}>
                <FitText style={styles.buttonText} maxLines={2} minScale={0.6}>
                  {str(key)}
                </FitText>
              </View>
            ))}
          </Section>

          <Section title="Try again banner (40 pt, 300 pt wide)">
            <View style={[styles.box, { width: 300 }]}>
              <FitText style={styles.banner} maxLines={2} minScale={0.6}>
                {str('tryOnceMore')}
              </FitText>
            </View>
          </Section>

          <Section title="Completion card (title 48 pt, subtitle, buttons; 300 pt wide)">
            <View style={[styles.box, { width: 300 }]}>
              <FitText style={styles.cardTitle} maxLines={2} minScale={0.6}>
                {str('amazing')}
              </FitText>
              <FitText
                font="body"
                style={styles.cardSubtitle}
                maxLines={3}
                minScale={0.8}
              >
                {str('finishedAllLevels')}
              </FitText>
              {['restart', 'nextGame', 'mainMenuFull'].map(key => (
                <FitText
                  key={key}
                  font="body"
                  style={styles.actionText}
                  maxLines={2}
                  minScale={0.8}
                >
                  {str(key)}
                </FitText>
              ))}
            </View>
          </Section>

          <Section title="Album and badges">
            {['albumTitle', 'starsShelfTitle', 'badgesTitle', 'notMetYet'].map(
              key => (
                <View key={key} style={[styles.box, { width: 110 }]}>
                  <FitText
                    style={styles.albumLabel}
                    maxLines={2}
                    minScale={0.7}
                  >
                    {str(key)}
                  </FitText>
                </View>
              )
            )}
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Toggle({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.toggle}>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.cream },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toggle: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: PALETTE.gold,
  },
  toggleText: { fontFamily: FONTS.bodyHeavy, fontSize: 16, color: PALETTE.ink },
  sectionTitle: {
    fontFamily: FONTS.bodyHeavy,
    fontSize: 14,
    color: PALETTE.inkSoft,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Dashed outline marks the exact width the text has to fit inside.
  box: {
    alignItems: 'center',
    padding: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: PALETTE.inkSoft,
  },
  pill: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 3 },
  pillFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(10,61,98,0.12)',
  },
  worldLabel: {
    color: PALETTE.ink,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  worldTitle: {
    color: PALETTE.ink,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  tileTitle: {
    color: PALETTE.ink,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 4, flexShrink: 1 },
  chipFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.pill,
    backgroundColor: PALETTE.gold,
  },
  chipText: { ...titleText(20, PALETTE.ink) },
  buttonText: { ...titleText(26, PALETTE.ink), textAlign: 'center' },
  banner: { ...titleText(40, PALETTE.ink), textAlign: 'center' },
  cardTitle: { ...titleText(48, PALETTE.red), textAlign: 'center' },
  cardSubtitle: { fontSize: 20, color: PALETTE.ink, textAlign: 'center' },
  actionText: { fontSize: 18, color: PALETTE.ink, textAlign: 'center' },
  albumLabel: { color: PALETTE.ink, fontSize: 14, textAlign: 'center' },
});
