import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { t, MIN_TOUCH_TARGET, TOUCH_SLOP } from '../../constants';
import { tapFeedback } from '../../utils/haptics';

const SideMenu = ({ onBackToMenu, currentLanguage }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  // Toggle menu visibility
  const toggleMenu = () => {
    tapFeedback();
    setMenuVisible(!menuVisible);
  };

  const handleBackToMenu = () => {
    tapFeedback();
    setMenuVisible(false);
    onBackToMenu();
  };

  return (
    <View style={styles.container}>
      {/* Button to open the options menu */}
      <TouchableOpacity
        style={styles.button}
        onPress={toggleMenu}
        hitSlop={TOUCH_SLOP}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t(currentLanguage, 'a11yOpenMenu')}
      >
        <MaterialIcons name="menu" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal for the options menu */}
      <Modal
        transparent={true}
        visible={menuVisible}
        animationType="fade"
        onRequestClose={toggleMenu}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleMenu} // Close menu when tapping outside
          accessible={false}
        >
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBackToMenu}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t(currentLanguage, 'a11yMainMenuButton')}
            >
              <MaterialIcons name="home" size={28} color="#007BFF" />
              <Text style={styles.optionText}>
                {t(currentLanguage, 'mainMenuFull')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: MIN_TOUCH_TARGET,
    alignContent: 'center',
    alignItems: 'center',
  },
  button: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  menu: {
    backgroundColor: '#fff',
    width: 240,
    padding: 15,
    marginRight: 10,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 20,
    paddingHorizontal: 10,
    color: '#333',
    fontWeight: '600',
  },
});

export default SideMenu;
