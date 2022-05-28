import React, {useState} from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [animatedImages, setAnimatedImages] = useState([1,2,3,4,5,6,7,8,9,10,11,12]);

  return (
    <View style={styles.container}>
     <View style={{
          flex: 0.2,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 10,
          flexDirection: 'row',
          backgroundColor: 'blue',
        }}>

      </View>
      <View style={{
          flex: 0.9,
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          alignContent:'stretch',
          padding: 10,
          flexWrap: 'wrap',
          flexDirection: 'row',
          paddingBottom: 50,
        }}>
          {animatedImages.map(animatedImage => (
                <View 
                  key={`${animatedImage}-animatedImage`}
                  style={{
                    width: '28%',
                    height: 100,
                    backgroundColor: '#ff0011',
                    margin: 10,
                    borderRadius: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text>{animatedImage}</Text>
                </View>
              )
            )
          }
        </View>
      <StatusBar style="auto" />
    </View>
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
