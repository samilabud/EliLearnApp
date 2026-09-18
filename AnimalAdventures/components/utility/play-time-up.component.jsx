import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';
import ParentalGate from '../parents/parental-gate.component';

/** Minutes handed back when a grown-up allows more play. */
const EXTENSION_MINUTES = 10;

/**
 * The end of the daily play allowance.
 *
 * It winds down rather than cutting off: the animal is asleep, the words are
 * friendly, and there is no failure language anywhere. The only way past is
 * the parental gate, which is what makes the limit worth setting.
 */
export default function PlayTimeUp({ currentLanguage, onMoreTime }) {
  const [fontsLoaded] = useFonts({ Bangers_400Regular });
  const [gateVisible, setGateVisible] = useState(false);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/animations/animals/sleeping-polar-bear.json')}
        autoPlay
        loop
        resizeMode="contain"
        style={styles.animation}
      />

      <Text
        style={[
          styles.title,
          fontsLoaded && { fontFamily: 'Bangers_400Regular' },
        ]}
      >
        {t(currentLanguage, 'timeUpTitle')}
      </Text>

      <Text style={styles.subtitle}>
        {t(currentLanguage, 'timeUpSubtitle')}
      </Text>

      <TouchableOpacity
        style={styles.grownUpButton}
        onPress={() => {
          tapFeedback();
          setGateVisible(true);
        }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t(currentLanguage, 'timeUpGrownUp')}
      >
        <Text style={styles.grownUpText}>
          {t(currentLanguage, 'timeUpGrownUp')}
        </Text>
      </TouchableOpacity>

      <ParentalGate
        visible={gateVisible}
        currentLanguage={currentLanguage}
        onPass={() => {
          setGateVisible(false);
          onMoreTime(EXTENSION_MINUTES);
        }}
        onCancel={() => setGateVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A3D62',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  animation: {
    width: 180,
    height: 180,
  },
  title: {
    fontSize: 34,
    color: '#FFD700',
    textAlign: 'center',
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 3 },
  },
  subtitle: {
    fontSize: 18,
    color: '#DCE8F0',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 26,
    maxWidth: 320,
  },
  grownUpButton: {
    marginTop: 32,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  grownUpText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
});
