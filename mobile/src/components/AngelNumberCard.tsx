import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  LinearGradient, 
  Stop, 
  Rect, 
  Path, 
  Ellipse,
  Polygon
} from 'react-native-svg';
import { AngelNumber } from '../data/divinationData';

interface AngelNumberCardProps {
  card: AngelNumber;
  width?: number;
}

const AngelNumberCard: React.FC<AngelNumberCardProps> = ({ 
  card, 
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
        {/* Dekoratif Dış Çerçeveler (Absolute) */}
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

        {/* İçerik Düzeni (Flex Column) */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          {/* Merkezdeki Devasa Rakam */}
          <Text style={styles.numberText} adjustsFontSizeToFit numberOfLines={1}>
            {card.number}
          </Text>

          {/* Ruhsal Anlam (İtalik) */}
          <Text style={styles.meaningText}>"{card.meaning}"</Text>

          {/* Çizgi */}
          <View style={styles.dividerSpacing}>
            <Svg viewBox="0 0 160 10" width="120" height="10">
              <Defs>
                <LinearGradient id="lineGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#c59b6d" />
                  <Stop offset="50%" stopColor="#e0c296" />
                  <Stop offset="100%" stopColor="#c59b6d" />
                </LinearGradient>
              </Defs>
              <Path d="M 0 5 L 60 5" stroke="url(#lineGoldGrad)" strokeWidth="1.5" />
              <Path d="M 100 5 L 160 5" stroke="url(#lineGoldGrad)" strokeWidth="1.5" />
              <Polygon points="80,0 75,5 80,10 85,5" fill="url(#lineGoldGrad)" />
              <Ellipse cx="80" cy="5" rx="10" ry="2" fill="none" stroke="#e0c296" strokeWidth="1" />
            </Svg>
          </View>

          {/* Rehberlik Kutusu */}
          <View style={styles.actionBox}>
            <Text style={styles.actionTitle}>GÜNÜN REHBERLİĞİ</Text>
            <Text style={styles.actionText}>{card.guidance}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 72,
    fontWeight: 'bold',
    color: '#5a4634',
    letterSpacing: 10,
    textAlign: 'center',
    width: '100%',
    textShadowColor: 'rgba(224, 194, 150, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: 20,
  },
  meaningText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 18,
    color: '#4a3b2c',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  dividerSpacing: {
    marginTop: 50, // 3-4 satırlık sabit boşluk
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBox: {
    backgroundColor: 'rgba(253, 244, 227, 0.90)',
    borderWidth: 1,
    borderColor: '#e0c296',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '88%', // Yanlardan boşluk kalması için %100 yerine küçültüldü
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8c7355',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  actionText: {
    fontSize: 14,
    color: '#5a4634',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});

export default AngelNumberCard;
