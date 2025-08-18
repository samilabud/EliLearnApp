import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ScrollView,
  Image,
} from 'react-native';
import AnimalScreen from '../animals/animal.screen.component';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MySplashScreen } from '../utility/my-splash-screen.component';
import SideMenu from '../side_menu/side_menu.component';

function HomeScreen({ currentLanguage, onBackToMenu }) {
  const [isLoading, setIsLoading] = useState(true);

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  useEffect(() => {
    delay(4000).then(() => setIsLoading(false));
  }, []);

  return (
    <SafeAreaProvider>
      {isLoading ? (
        <View>
          <MySplashScreen />
          <StatusBar style="auto" />
        </View>
      ) : (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBackToMenu}>
              <MaterialIcons name="arrow-back" size={28} color="white" />
              <Text style={styles.backButtonText}>
                {currentLanguage === 'en' ? 'Back' : 'Atrás'}
              </Text>
            </TouchableOpacity>

            <Image
              source={require('../../assets/logo/logoEliLearn.png')}
              style={styles.logo}
            />

            <SideMenu
              onBackToMenu={onBackToMenu}
              currentLanguage={currentLanguage}
            />
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.content}>
            <AnimalScreen currentLanguage={currentLanguage} />
          </ScrollView>
          <StatusBar style="auto" />
        </SafeAreaView>
      )}
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
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
    zIndex: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  logo: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
  },
});

export default HomeScreen;
