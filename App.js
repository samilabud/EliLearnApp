import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AnimalScreen from './components/animals/animal.screen.component';
import { SafeArea } from './components/utility/safe-area.component';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const onButtonToggle = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };

  return (
    <SafeArea>
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
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    height: '100%',
  },
  settings: {
    position: 'absolute',
    zIndex: 4,
    left: '92%',
    top: '2%',
  },
  languageText: {
    fontSize: 10,
  },
});
