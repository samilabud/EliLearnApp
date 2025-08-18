import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TouchableOpacity, View, Text, Image } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MySplashScreen } from '../utility/my-splash-screen.component';

function MainMenu({ onModeSelect, currentLanguage, setCurrentLanguage }) {
  const [isLoading, setIsLoading] = useState(true);

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  useEffect(() => {
    delay(4000).then(() => setIsLoading(false));
  }, []);

  const onLanguageToggle = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };

  if (isLoading) {
    return (
      <View>
        <MySplashScreen />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        {/* Header with Logo and Language Selector */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo/logoEliLearn.png')}
            style={styles.logo}
          />
          <TouchableOpacity
            style={styles.languageToggle}
            onPress={onLanguageToggle}
          >
            <MaterialIcons name="translate" size={28} color="white" />
            <Text style={styles.languageText}>
              {currentLanguage.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.title}>
            {currentLanguage === 'en'
              ? 'Animal Adventures'
              : 'Aventuras de Animales'}
          </Text>

          <Text style={styles.subtitle}>
            {currentLanguage === 'en'
              ? 'Choose your adventure!'
              : '¡Elige tu aventura!'}
          </Text>

          {/* Mode Selection Buttons */}
          <View style={styles.modeContainer}>
            {/* Mode 1: Learn Animal Sounds and Names */}
            <TouchableOpacity
              style={styles.modeButton}
              onPress={() => onModeSelect('learn')}
            >
              <View style={styles.modeIconContainer}>
                <MaterialIcons name="school" size={60} color="#4CAF50" />
              </View>
              <Text style={styles.modeTitle}>
                {currentLanguage === 'en'
                  ? 'Learn Animal Sounds & Names'
                  : 'Aprende Sonidos y Nombres'}
              </Text>
              <Text style={styles.modeDescription}>
                {currentLanguage === 'en'
                  ? 'Discover animals and their sounds'
                  : 'Descubre animales y sus sonidos'}
              </Text>
            </TouchableOpacity>

            {/* Mode 2: Guessing Game (Under Construction) */}
            <TouchableOpacity
              style={[styles.modeButton, styles.underConstruction]}
              onPress={() => {
                // Show under construction message
                alert(
                  currentLanguage === 'en'
                    ? 'Coming Soon! This feature is under construction.'
                    : '¡Pronto! Esta función está en construcción.'
                );
              }}
            >
              <View style={styles.modeIconContainer}>
                <MaterialIcons name="construction" size={60} color="#FF9800" />
              </View>
              <Text style={styles.modeTitle}>
                {currentLanguage === 'en'
                  ? 'Guess the Animal'
                  : 'Adivina el Animal'}
              </Text>
              <Text style={styles.modeDescription}>
                {currentLanguage === 'en'
                  ? 'Test your knowledge!'
                  : '¡Pon a prueba tu conocimiento!'}
              </Text>
              <View style={styles.constructionBadge}>
                <Text style={styles.constructionText}>
                  {currentLanguage === 'en'
                    ? 'UNDER CONSTRUCTION'
                    : 'EN CONSTRUCCIÓN'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  logo: {
    width: 120,
    height: 50,
    resizeMode: 'contain',
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  languageText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: '600',
  },
  modeContainer: {
    width: '100%',
    gap: 30,
  },
  modeButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  underConstruction: {
    opacity: 0.8,
    backgroundColor: '#F5F5F5',
  },
  modeIconContainer: {
    marginBottom: 15,
  },
  modeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  modeDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  constructionBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginTop: 15,
    borderWidth: 2,
    borderColor: '#E65100',
  },
  constructionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default MainMenu;
