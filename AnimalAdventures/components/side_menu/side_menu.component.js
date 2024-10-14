import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SideMenu = () => {
  const [menuVisible, setMenuVisible] = useState(false);

  // Toggle menu visibility
  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  return (
    <View style={styles.container}>
      {/* Button to open the options menu */}
      <TouchableOpacity style={styles.button} onPress={toggleMenu}>
        <MaterialIcons name="menu" size={15} color="black" />
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
            <TouchableOpacity onPress={() => console.log('Option 1')}>
              <Text style={styles.optionText}>Option 1</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => console.log('Option 2')}>
              <Text style={styles.optionText}>Option 2</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 30,
    alignContent: 'center',
    alignItems: 'center',
  },
  button: {
    padding: 7,
    backgroundColor: '#007BFF',
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
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
    padding: 10,
    marginRight: 10, // Align to the right
    borderRadius: 5,
  },
  optionText: {
    fontSize: 18,
    padding: 10,
  },
});

export default SideMenu;
