import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  LinearGradient, 
  Stop, 
  Rect, 
  Path
} from 'react-native-svg';

interface AffirmationCardProps {
  affirmation: { opener: string; middle: string; closer: string };
  width?: number;
}

const AffirmationCard: React.FC<AffirmationCardProps> = ({ 
  affirmation, 
  width = Dimensions.get('window').width * 0.75 
}) => {
  const height = (width * 650) / 400; // Aspect ratio 400:650
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <View style={[styles.container, { width, height }]}>
      <ImageBackground 
        source={require('../../assets/angel_bg.jpg')} 
        style={styles.backgroundImage}
        imageStyle={{ borderRadius: 20 }}
      >
        {/* Dekoratif Dış Çerçeveler */}
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="0 0 400 650" width="100%" height="100%">
            <Defs>
              <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#c59b6d" />
                <Stop offset="50%" stopColor="#e0c296" />
                <Stop offset="100%" stopColor="#c59b6d" />
              </LinearGradient>
            </Defs>
            
            <Rect x="15" y="15" width="370" height="620" rx="15" fill="none" stroke="url(#goldGrad)" strokeWidth="1.5" />
            <Rect x="25" y="25" width="350" height="600" rx="10" fill="none" stroke="#c59b6d" strokeWidth="1" opacity="0.6" />
            
            <Path d="M 15 45 L 15 15 L 45 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 385 45 L 385 15 L 355 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 15 605 L 15 635 L 45 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 385 605 L 385 635 L 355 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
          </Svg>
        </View>

        {/* İçerik Düzeni */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.affirmationContainer}>
            <Text style={styles.affirmationText}>{affirmation.opener}</Text>
            <View style={styles.spacer} />
            <Text style={styles.affirmationTextEmphasis}>{affirmation.middle}</Text>
            <View style={styles.spacer} />
            <Text style={styles.affirmationText}>{affirmation.closer}</Text>
          </View>
        </Animated.View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affirmationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  affirmationText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 18,
    color: '#5a4634',
    textAlign: 'center',
    lineHeight: 26,
  },
  affirmationTextEmphasis: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4a3b2c',
    textAlign: 'center',
    lineHeight: 32,
    fontStyle: 'italic',
    marginVertical: 10,
  },
  spacer: {
    height: 15, // Cümleleri birbirine yaklaştırarak dikeyde daralttım
  },
});

export default AffirmationCard;
