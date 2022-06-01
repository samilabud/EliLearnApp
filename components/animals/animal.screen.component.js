import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ImageBackground } from "react-native";
import { Audio } from 'expo-av';
import LottieView from 'lottie-react-native';
import { animalList } from "./animal.list";

const AnimalScreen = () => {
  const backgroundImage = require("../../assets/backgrounds/pawel-czerwinski-4gWNAWeOvP0-unsplash.jpg");
  const animRef = useRef([]);
  const [sound, setSound] = React.useState();

  const resetAnim = () => {
    animalList.forEach((animatedImage) => {
      animRef.current[animatedImage.name].reset();
    });
  }
  const resetAndPlayAnim = (playCurrent, soundUrl) => {
    resetAnim();
    playSound(soundUrl);
    playCurrent.play();
  }
  
  async function playSound(soundFile) {
    const { sound } = await Audio.Sound.createAsync(
      soundFile
    );
    setSound(sound);
    await sound.playAsync(); 
  }

  return (
    <View
        style={styles.container}
      >
       <ImageBackground source={backgroundImage} resizeMode="cover" style={styles.backgroundImage}>
        {animalList.map((animatedImage) => (
            <TouchableOpacity
              key={`${animatedImage.name}-animatedImage`}
              style={styles.button}
              onPress={()=>resetAndPlayAnim(animRef.current[animatedImage.name], animatedImage.sound)}
            >
                <LottieView
                  autoPlay={false}
                  autoSize={false}
                  ref={el => (animRef.current[animatedImage.name] = el)}
                  key="animation"
                  resizeMode="contain"
                  loop={false}
                  source={animatedImage.animation_path}
                  style={{zIndex: 2}}
                />
                <View style={styles.animationBackground}></View>
              {/* <Text>{animatedImage.name}</Text>  */}
            </TouchableOpacity>
        ))}
        </ImageBackground>
      </View>
  )
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    alignContent: 'stretch',
    flexWrap: 'wrap',
    flexDirection: 'row',
  },
  button: {
    width: '27%',
    height: 100,
    margin: 10,
    
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  animationBackground: {
    backgroundColor: '#ffffff',
    height: 70,
    width: '100%',
    borderRadius: 10,
    zIndex: 1,
    position: 'absolute',
  }
});
export default AnimalScreen;