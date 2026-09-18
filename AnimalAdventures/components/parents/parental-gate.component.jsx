import React, { useCallback, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  t,
  NUMBER_WORDS,
  LARGE_TOUCH_TARGET,
  MIN_TOUCH_TARGET,
} from '../../constants';
import { tapFeedback, errorFeedback } from '../../utils/haptics';

/** Digits the adult has to reproduce. Three is enough to stop a toddler. */
const CODE_LENGTH = 3;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const randomCode = () =>
  Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 10));

/**
 * A gate in front of anything meant for grown-ups.
 *
 * It asks for a number shown in words. That is deliberately a reading task
 * and not an arithmetic one: a child young enough for this app cannot read
 * "four", while every adult can, including one who is bad at mental maths.
 */
export default function ParentalGate({
  visible,
  currentLanguage,
  onPass,
  onCancel,
}) {
  const [code, setCode] = useState(randomCode);
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  const words = NUMBER_WORDS[currentLanguage] || NUMBER_WORDS.en;
  const prompt = useMemo(
    () => code.map(digit => words[digit]).join('  ·  '),
    [code, words]
  );

  const reset = useCallback(() => {
    setCode(randomCode());
    setEntry('');
  }, []);

  const handleDigit = useCallback(
    digit => {
      tapFeedback();
      setWrong(false);
      const next = entry + digit;

      if (next.length < CODE_LENGTH) {
        setEntry(next);
        return;
      }

      if (next === code.join('')) {
        setEntry('');
        setCode(randomCode());
        onPass();
      } else {
        errorFeedback();
        setWrong(true);
        reset();
      }
    },
    [entry, code, onPass, reset]
  );

  const handleDelete = useCallback(() => {
    tapFeedback();
    setWrong(false);
    setEntry(prev => prev.slice(0, -1));
  }, []);

  const handleCancel = useCallback(() => {
    tapFeedback();
    reset();
    setWrong(false);
    onCancel();
  }, [reset, onCancel]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t(currentLanguage, 'gateTitle')}</Text>
          <Text style={styles.instruction}>
            {t(currentLanguage, 'gateInstruction')}
          </Text>

          <Text style={styles.prompt} accessibilityRole="text">
            {prompt}
          </Text>

          <View style={styles.dots}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < entry.length && styles.dotFilled]}
              />
            ))}
          </View>

          <Text style={[styles.error, !wrong && styles.errorHidden]}>
            {t(currentLanguage, 'gateWrong')}
          </Text>

          <View style={styles.keypad}>
            {KEYS.map(key => (
              <TouchableOpacity
                key={key}
                style={styles.key}
                onPress={() => handleDigit(key)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t(currentLanguage, 'a11yGateDigit', {
                  number: key,
                })}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.key, styles.keyMuted]}
              onPress={handleDelete}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yGateDelete')}
            >
              <MaterialIcons name="backspace" size={24} color="#0A3D62" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.key}
              onPress={() => handleDigit('0')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yGateDigit', {
                number: '0',
              })}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.key, styles.keyMuted]}
              onPress={handleCancel}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'cancel')}
            >
              <MaterialIcons name="close" size={24} color="#0A3D62" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFD700',
    padding: 22,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A3D62',
    textAlign: 'center',
  },
  instruction: {
    fontSize: 18,
    color: '#5A5A5A',
    marginTop: 4,
    textAlign: 'center',
  },
  prompt: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#BD0000',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0A3D62',
  },
  dotFilled: {
    backgroundColor: '#0A3D62',
  },
  error: {
    fontSize: 16,
    color: '#BD0000',
    marginTop: 10,
    height: 22,
  },
  // Kept in the layout so the keypad does not jump when the message appears.
  errorHidden: {
    opacity: 0,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  key: {
    width: 84,
    height: LARGE_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 14,
    backgroundColor: '#F1F6F9',
    borderWidth: 2,
    borderColor: '#CFE0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMuted: {
    backgroundColor: '#E6EEF3',
  },
  keyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A3D62',
  },
});
