import React from 'react';
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import {
  CHILD_AGE_OPTIONS,
  PLAY_LIMIT_OPTIONS,
  useSettings,
} from '../../contexts/settings.context';
import { BouncyButton } from '../utility/bouncy-button.component';

/**
 * The things this app does not do.
 *
 * Every one is true of the current build. They are stated in the app rather
 * than only in the store listing because the parent deciding whether to hand
 * over the phone is holding the phone, not reading Play. "No purchases" is
 * dropped on iOS, where this app is a paid download rather than free -
 * stating it there would be false, not just incomplete.
 */
const PROMISE_KEYS = [
  'promiseNoAds',
  'promiseNoAccounts',
  ...(Platform.OS === 'ios' ? [] : ['promiseNoPurchases']),
  'promiseNoLinks',
  'promiseNoData',
];

// Opens in the device browser (or the PayPal app, if installed) rather than
// any in-app payment flow - a voluntary, parent-initiated donation link, not
// a purchase this app sells or processes itself.
const PAYPAL_DONATE_URL = 'https://paypal.me/samilabud';

const appVersion =
  Constants?.expoConfig?.version || Constants?.manifest?.version || '';

/** String key for each age band, matching CHILD_AGE_OPTIONS from settings. */
const AGE_LABEL_KEYS = {
  under4: 'ageUnder4',
  '4to6': 'age4to6',
  '7plus': 'age7plus',
};

export default function ParentArea({ visible, currentLanguage, onClose }) {
  const {
    soundEnabled,
    setSoundEnabled,
    playLimitMinutes,
    setPlayLimitMinutes,
    ambientEffectsEnabled,
    setAmbientEffectsEnabled,
    childAgeBand,
    setChildAgeBand,
  } = useSettings();

  const handleSound = value => {
    tapFeedback();
    setSoundEnabled(value);
  };

  const handleAmbientEffects = value => {
    tapFeedback();
    setAmbientEffectsEnabled(value);
  };

  const handleLimit = minutes => {
    tapFeedback();
    setPlayLimitMinutes(minutes);
  };

  const handleChildAge = band => {
    tapFeedback();
    setChildAgeBand(band);
  };

  const handleDonate = () => {
    tapFeedback();
    Linking.openURL(PAYPAL_DONATE_URL).catch(() => {});
  };

  const limitLabel = minutes =>
    minutes === 0
      ? t(currentLanguage, 'noLimit')
      : t(currentLanguage, 'minutesShort', { count: minutes });

  const ageLabel = band => t(currentLanguage, AGE_LABEL_KEYS[band]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t(currentLanguage, 'forParents')}</Text>
            <BouncyButton
              onPress={() => {
                tapFeedback();
                onClose();
              }}
              style={styles.closeButton}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'close')}
            >
              <MaterialIcons name="close" size={26} color="#0A3D62" />
            </BouncyButton>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {/* Sound */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                {t(currentLanguage, 'soundLabel')}
              </Text>
              <Switch
                value={soundEnabled}
                onValueChange={handleSound}
                trackColor={{ false: '#C8D6DE', true: '#BD0000' }}
                thumbColor="#ffffff"
                accessibilityLabel={t(currentLanguage, 'a11ySoundToggle', {
                  state: soundEnabled
                    ? t(currentLanguage, 'off')
                    : t(currentLanguage, 'on'),
                })}
              />
            </View>

            {/* Ambient bubbles - the one purely decorative effect, and the
                one most worth switching off on an older phone. */}
            <View style={styles.row}>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowLabel}>
                  {t(currentLanguage, 'ambientEffectsLabel')}
                </Text>
                <Text style={styles.rowHint}>
                  {t(currentLanguage, 'ambientEffectsHint')}
                </Text>
              </View>
              <Switch
                value={ambientEffectsEnabled}
                onValueChange={handleAmbientEffects}
                trackColor={{ false: '#C8D6DE', true: '#BD0000' }}
                thumbColor="#ffffff"
                accessibilityLabel={t(
                  currentLanguage,
                  'a11yAmbientEffectsToggle',
                  {
                    state: ambientEffectsEnabled
                      ? t(currentLanguage, 'off')
                      : t(currentLanguage, 'on'),
                  }
                )}
              />
            </View>

            {/* Daily play limit */}
            <Text style={styles.sectionLabel}>
              {t(currentLanguage, 'playLimitLabel')}
            </Text>
            <View style={styles.chips}>
              {PLAY_LIMIT_OPTIONS.map(minutes => {
                const active = playLimitMinutes === minutes;
                return (
                  <BouncyButton
                    key={minutes}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleLimit(minutes)}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(currentLanguage, 'a11yPlayLimit', {
                      label: limitLabel(minutes),
                    })}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {limitLabel(minutes)}
                    </Text>
                  </BouncyButton>
                );
              })}
            </View>

            {/* Child's age - under 4 keeps Guess the First Letter vowels-only */}
            <Text style={styles.sectionLabel}>
              {t(currentLanguage, 'childAgeLabel')}
            </Text>
            <View style={styles.chips}>
              {CHILD_AGE_OPTIONS.map(band => {
                const active = childAgeBand === band;
                return (
                  <BouncyButton
                    key={band}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleChildAge(band)}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(currentLanguage, 'a11yChildAge', {
                      label: ageLabel(band),
                    })}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {ageLabel(band)}
                    </Text>
                  </BouncyButton>
                );
              })}
            </View>

            {/* What this app does not do */}
            <Text style={styles.sectionLabel}>
              {t(currentLanguage, 'aboutTitle')}
            </Text>
            <View style={styles.promises}>
              {PROMISE_KEYS.map(key => (
                <View key={key} style={styles.promise}>
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color="#1E8E3E"
                  />
                  <Text style={styles.promiseText}>
                    {t(currentLanguage, key)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Android only - the iOS build is a paid download instead, so
                there's nothing to donate towards there. */}
            {Platform.OS === 'android' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t(currentLanguage, 'supportTitle')}
                </Text>
                <BouncyButton
                  onPress={handleDonate}
                  style={styles.donateButton}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t(currentLanguage, 'a11yDonate')}
                >
                  <MaterialIcons name="favorite" size={20} color="#ffffff" />
                  <Text style={styles.donateButtonText}>
                    {t(currentLanguage, 'donateLabel')}
                  </Text>
                </BouncyButton>
              </>
            )}

            <Text style={styles.version}>
              {t(currentLanguage, 'brandCredit')}
              {!!appVersion &&
                ` · ${t(currentLanguage, 'versionLabel', { version: appVersion })}`}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 4,
    borderColor: '#FFD700',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEF3',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A3D62',
  },
  closeButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    paddingBottom: 36,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  rowLabel: {
    fontSize: 18,
    color: '#0A3D62',
    fontWeight: '600',
  },
  rowTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  rowHint: {
    marginTop: 2,
    fontSize: 14,
    color: '#8A9BA6',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0A3D62',
    marginTop: 22,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#CFE0EA',
    backgroundColor: '#F1F6F9',
  },
  chipActive: {
    backgroundColor: '#BD0000',
    borderColor: '#BD0000',
  },
  chipText: {
    fontSize: 18,
    color: '#0A3D62',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  promises: {
    gap: 10,
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  promiseText: {
    fontSize: 18,
    color: '#333333',
    flexShrink: 1,
  },
  // PayPal's own brand blue, so this reads as "leaves to PayPal" rather
  // than looking like another in-app control.
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#0070BA',
  },
  donateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  version: {
    marginTop: 24,
    fontSize: 14,
    color: '#8A9BA6',
  },
});
