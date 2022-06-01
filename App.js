import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from "react-native";
import AnimalScreen from './components/animals/animal.screen.component';
import LottieView from 'lottie-react-native';
import { SafeArea } from './components/utility/safe-area.component';

export default function App() {

  return (
    <SafeArea>
      <View style={styles.container}>
        {/* <View
          style={{
            flex: 0.2,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 10,
            flexDirection: 'row',
            backgroundColor: 'blue',
          }}
        ></View> */}
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
    width: '100%',
    height: '20%',
  },
});
