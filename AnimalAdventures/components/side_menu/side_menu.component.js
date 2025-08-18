import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SideMenu = ({ onBackToMenu, currentLanguage }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  // Toggle menu visibility
  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleBackToMenu = () => {
    setMenuVisible(false);
    onBackToMenu();
  };

  return (
    <View style={styles.container}>
      {/* Button to open the options menu */}
      <TouchableOpacity style={styles.button} onPress={toggleMenu}>
        <MaterialIcons name="menu" size={20} color="white" />
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
        >
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBackToMenu}
            >
              <MaterialIcons name="home" size={20} color="#007BFF" />
              <Text style={styles.optionText}>
                {currentLanguage === 'en' ? 'Main Menu' : 'Menú Principal'}
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
    width: 40,
    alignContent: 'center',
    alignItems: 'center',
  },
  button: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
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
    width: 200,
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
    paddingVertical: 5,
  },
  optionText: {
    fontSize: 18,
    padding: 10,
    color: '#333',
    fontWeight: '600',
  },
});

export default SideMenu;
