import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import AnimalScreen from '../animals/animal.screen.component.jsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import SideMenu from '../side_menu/side_menu.component';
import { t, MIN_TOUCH_TARGET } from '../../constants';
import { tapFeedback } from '../../utils/haptics';

function HomeScreen({ currentLanguage, onBackToMenu }) {
  const [fadeAnim] = React.useState(() => new Animated.Value(0));

  const handleBack = () => {
    tapFeedback();
    onBackToMenu();
  };

  // The launch splash now lives in App, so this screen just fades itself in.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t(currentLanguage, 'a11yBackButton')}
          >
            <MaterialIcons name="arrow-back" size={28} color="white" />
            <Text style={styles.backButtonText}>
              {t(currentLanguage, 'back')}
            </Text>
          </TouchableOpacity>

          <Image
            source={require('../../assets/logo/logoEliLearn.png')}
            style={styles.logo}
            accessible={false}
            accessibilityRole="image"
          />

          <SideMenu
            onBackToMenu={onBackToMenu}
            currentLanguage={currentLanguage}
          />
        </View>

        {/* Scrollable Content */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView style={styles.content}>
            <AnimalScreen currentLanguage={currentLanguage} />
          </ScrollView>
        </Animated.View>
    <StatusBar style="auto" />
    </SafeAreaView>
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
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  logo: {
    width: 120,
    height: 48,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
  },
});

export default HomeScreen;


