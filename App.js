import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from 'react-native';
import AnimalScreen from './components/animals/animal.screen.component';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MySplashScreen } from './components/utility/my-splash-screen.component';

export default function App() {
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
        <View style={styles.container}>
          <TouchableOpacity style={styles.settings} onPress={onButtonToggle}>
            <Text style={styles.languageText}>{currentLanguage}</Text>
            {currentLanguage === 'es' ? (
              <MaterialIcons name="translate" size={20} color="black" />
            ) : (
              <MaterialCommunityIcons
                name="translate-off"
                size={20}
                color="black"
              />
            )}
          </TouchableOpacity>
          <AnimalScreen currentLanguage={currentLanguage} />
          <StatusBar style="auto" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#BD0000',
    height: '100%',
  },
  settings: {
    position: 'absolute',
    zIndex: 4,
    left: '92%',
    top: Platform.OS === 'ios' ? '5%' : '4%',
  },
  languageText: {
    fontSize: 10,
  },
});
