import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
  Button,
} from 'react-native';
import AnimalScreen from '../animals/animal.screen.component';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MySplashScreen } from '../utility/my-splash-screen.component';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';

const Drawer = createDrawerNavigator();

function HomeScreen({ navigation }) {
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
          <Button
            style={styles.settings}
            onPress={() => navigation.openDrawer()}
            title="Open Right Side Menu"
          />
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

function CustomDrawerContent(props) {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const onButtonToggle = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'es' : 'en');
  };
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
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
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerPosition="right" // Set drawer position to right
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
    </Drawer.Navigator>
  );
}
