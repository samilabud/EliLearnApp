import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import {
  PLAY_LIMIT_OPTIONS,
  useSettings,
} from '../../contexts/settings.context';

/**
 * The five things this app does not do.
 *
 * Every one is true of the current build. They are stated in the app rather
 * than only in the store listing because the parent deciding whether to hand
 * over the phone is holding the phone, not reading Play.
 */
const PROMISE_KEYS = [
  'promiseNoAds',
  'promiseNoAccounts',
  'promiseNoPurchases',
  'promiseNoLinks',
  'promiseNoData',
];

const appVersion =
  Constants?.expoConfig?.version || Constants?.manifest?.version || '';

export default function ParentArea({ visible, currentLanguage, onClose }) {
  const {
    soundEnabled,
    setSoundEnabled,
    playLimitMinutes,
    setPlayLimitMinutes,
  } = useSettings();

  const handleSound = value => {
    tapFeedback();
    setSoundEnabled(value);
  };

  const handleLimit = minutes => {
    tapFeedback();
    setPlayLimitMinutes(minutes);
  };

  const limitLabel = minutes =>
    minutes === 0
      ? t(currentLanguage, 'noLimit')
      : t(currentLanguage, 'minutesShort', { count: minutes });

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
            <TouchableOpacity
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
            </TouchableOpacity>
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

            {/* Daily play limit */}
            <Text style={styles.sectionLabel}>
              {t(currentLanguage, 'playLimitLabel')}
            </Text>
            <View style={styles.chips}>
              {PLAY_LIMIT_OPTIONS.map(minutes => {
                const active = playLimitMinutes === minutes;
                return (
                  <TouchableOpacity
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
                  </TouchableOpacity>
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

            {!!appVersion && (
              <Text style={styles.version}>
                {t(currentLanguage, 'versionLabel', { version: appVersion })}
              </Text>
            )}
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
  version: {
    marginTop: 24,
    fontSize: 14,
    color: '#8A9BA6',
  },
});
