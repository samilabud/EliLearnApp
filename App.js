import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import AnimalScreen from './components/animals/animal.screen.component';
import { SafeArea } from './components/utility/safe-area.component';

export default function App() {
  return (
    <SafeArea>
      <View style={styles.container}>
        <AnimalScreen />
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
});
