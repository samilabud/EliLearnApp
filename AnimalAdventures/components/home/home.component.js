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

function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const onButtonToggle = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };

  function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
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
            <Image
              source={require('../../assets/logo/logoEliLearn.png')}
              style={styles.logo}
            />
            <TouchableOpacity
              style={styles.languageToggle}
              onPress={onButtonToggle}
            >
              <MaterialIcons name="translate" size={24} color="black" />
              <Text style={styles.languageText}>
                {currentLanguage.toUpperCase()}
              </Text>
            </TouchableOpacity>
            <SideMenu />
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
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    zIndex: 10,
    paddingHorizontal: 10,
  },
  logo: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  languageText: {
    marginLeft: 4,
    fontSize: 16,
  },
});

export default HomeScreen;
