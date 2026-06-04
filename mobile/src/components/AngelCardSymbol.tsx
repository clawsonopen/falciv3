import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  LinearGradient, 
  Stop, 
  Filter, 
  FeGaussianBlur, 
  FeMerge, 
  FeMergeNode, 
  Rect, 
  Path, 
  G, 
  Ellipse,
  Polygon
} from 'react-native-svg';
import { AngelCard } from '../data/divinationData';

const AnimatedG = Animated.createAnimatedComponent(G) as any;
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AngelCardSymbolProps {
  card: AngelCard;
  width?: number;
}

const AngelCardSymbol: React.FC<AngelCardSymbolProps> = ({ 
  card, 
  width = Dimensions.get('window').width * 0.75 
}) => {
  const height = (width * 650) / 400; // Aspect ratio 400:650
  
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const drawAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(drawAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [glowAnim, drawAnim]);

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
        <View style={styles.content}>
          
          {/* 1. Başlık */}
          <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>
            {card.name.toLocaleUpperCase('tr-TR')}
          </Text>

          {/* 2. Ruhsal Mesaj (İtalik) */}
          <Text style={styles.messageText}>"{card.message}"</Text>

          {/* 3. Melek İkonu / Sembolizmi */}
          <View style={styles.symbolContainer}>
            <Svg viewBox="0 0 100 100" width="150" height="150">
              <Defs>
                <LinearGradient id="symbolGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#c59b6d" />
                  <Stop offset="50%" stopColor="#e0c296" />
                  <Stop offset="100%" stopColor="#c59b6d" />
                </LinearGradient>
                <Filter id="glow">
                  <FeGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <FeMerge>
                    <FeMergeNode in="coloredBlur" />
                    <FeMergeNode in="SourceGraphic" />
                  </FeMerge>
                </Filter>
              </Defs>
              <AnimatedG style={{ opacity: glowAnim }}>
                <Ellipse cx="50" cy="50" rx="45" ry="45" fill="none" stroke="url(#symbolGoldGrad)" strokeWidth="1" opacity="0.3" filter="url(#glow)" />
                <AnimatedPath
                  d={card.symbolSvg || "M50,10 L90,50 L50,90 L10,50 Z"} 
                  fill="none"
                  stroke="url(#symbolGoldGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  strokeDasharray="500"
                  strokeDashoffset={drawAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [500, 0]
                  })}
                />
              </AnimatedG>
            </Svg>
          </View>

          {/* 4. Rehber Melek İsmi ve Kanatlar */}
          {card.guide && (
            <View style={styles.guideRow}>
              {/* Sol Kanat (Gösterişli & Klasik) */}
              <Svg viewBox="0 0 110 100" width="28" height="28">
                <Defs>
                  <LinearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#c59b6d" />
                    <Stop offset="50%" stopColor="#e0c296" />
                    <Stop offset="100%" stopColor="#8c7355" />
                  </LinearGradient>
                </Defs>
                <Path d="M 23.94 1.13 C 18.06 2.53 12.56 5.8 8.1 10.3 C 5.8 12.6 2.3 17.6 1.4 19.8 C 0.7 21.6 0.2 24.3 0 26.5 C 3.1 23 8.3 19.3 13.5 17.4 C 18.6 15.6 24 15.2 29.3 16 C 21.7 18 15 22.8 9.8 28.5 C 7.3 31.3 5 35 3.8 38.6 C 7.5 35.1 12.3 31.8 17.1 29.7 C 22.3 27.5 28.1 26.7 33.6 27.4 C 26.6 29.1 20 33.2 14.8 38.4 C 12.2 41 9.9 44.4 8.7 47.9 C 12.5 44.8 17 41.7 21.9 39.8 C 26.6 38 32 37.3 37.2 38.1 C 30.6 39.7 24.4 43.6 19.6 48.7 C 17.1 51.3 14.9 54.8 13.9 58.4 C 17.7 55.4 22.3 52.6 27.2 50.9 C 32.1 49.3 37.7 48.8 43 49.8 C 36 51 29.3 54.7 24 59.8 C 21 62.7 18.2 66.8 17.1 70.8 C 21.5 68.3 26.5 66 31.8 64.6 C 37.3 63.2 43 62.8 48.6 63.6 C 41.6 65.6 35 70.4 29.8 76.1 C 28.6 77.4 26 80.7 25 82.5 C 30.6 80.3 36.6 78.4 42.6 77.4 C 54.7 75.4 67.5 76 79 80.5 C 84.8 82.7 91.2 86.5 96.1 91.1 C 98.6 93.4 100.8 96 102.7 98.8 C 103 98.2 103.3 97.5 103.6 96.9 C 109.1 84.7 109.6 70.4 105.4 57.5 C 101.4 45.4 92.5 34.6 81.3 26.7 C 72 20.1 60.5 15.3 49.2 13 C 48.8 12.9 48.3 12.8 47.9 12.7 C 54.3 19.3 58.8 28.3 60.1 37.7 C 58.9 34.4 56.5 31.4 53.6 29.3 C 48.9 25.8 42.6 24.7 36.8 25.9 C 37 25.4 37.1 24.9 37.3 24.4 C 40.5 16.9 39.5 8 34.2 1.5 C 31.4 -1 27.5 0.2 23.94 1.13 Z" fill="url(#wingGrad)" opacity="0.9" />
              </Svg>
              
              <Text style={styles.guideText}>{card.guide}</Text>
              
              {/* Sağ Kanat (Tam simetrik ayna efekti) */}
              <Svg viewBox="0 0 110 100" width="28" height="28">
                <Defs>
                  <LinearGradient id="wingGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#8c7355" />
                    <Stop offset="50%" stopColor="#e0c296" />
                    <Stop offset="100%" stopColor="#c59b6d" />
                  </LinearGradient>
                </Defs>
                <G transform="scale(-1, 1) translate(-110, 0)">
                  <Path d="M 23.94 1.13 C 18.06 2.53 12.56 5.8 8.1 10.3 C 5.8 12.6 2.3 17.6 1.4 19.8 C 0.7 21.6 0.2 24.3 0 26.5 C 3.1 23 8.3 19.3 13.5 17.4 C 18.6 15.6 24 15.2 29.3 16 C 21.7 18 15 22.8 9.8 28.5 C 7.3 31.3 5 35 3.8 38.6 C 7.5 35.1 12.3 31.8 17.1 29.7 C 22.3 27.5 28.1 26.7 33.6 27.4 C 26.6 29.1 20 33.2 14.8 38.4 C 12.2 41 9.9 44.4 8.7 47.9 C 12.5 44.8 17 41.7 21.9 39.8 C 26.6 38 32 37.3 37.2 38.1 C 30.6 39.7 24.4 43.6 19.6 48.7 C 17.1 51.3 14.9 54.8 13.9 58.4 C 17.7 55.4 22.3 52.6 27.2 50.9 C 32.1 49.3 37.7 48.8 43 49.8 C 36 51 29.3 54.7 24 59.8 C 21 62.7 18.2 66.8 17.1 70.8 C 21.5 68.3 26.5 66 31.8 64.6 C 37.3 63.2 43 62.8 48.6 63.6 C 41.6 65.6 35 70.4 29.8 76.1 C 28.6 77.4 26 80.7 25 82.5 C 30.6 80.3 36.6 78.4 42.6 77.4 C 54.7 75.4 67.5 76 79 80.5 C 84.8 82.7 91.2 86.5 96.1 91.1 C 98.6 93.4 100.8 96 102.7 98.8 C 103 98.2 103.3 97.5 103.6 96.9 C 109.1 84.7 109.6 70.4 105.4 57.5 C 101.4 45.4 92.5 34.6 81.3 26.7 C 72 20.1 60.5 15.3 49.2 13 C 48.8 12.9 48.3 12.8 47.9 12.7 C 54.3 19.3 58.8 28.3 60.1 37.7 C 58.9 34.4 56.5 31.4 53.6 29.3 C 48.9 25.8 42.6 24.7 36.8 25.9 C 37 25.4 37.1 24.9 37.3 24.4 C 40.5 16.9 39.5 8 34.2 1.5 C 31.4 -1 27.5 0.2 23.94 1.13 Z" fill="url(#wingGradRight)" opacity="0.9" />
                </G>
              </Svg>
            </View>
          )}

          {/* 5. Boşluk + Çizgi + Boşluk */}
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

          {/* 6. Günün Rehberliği (Aksiyon Kutusu) */}
          <View style={styles.actionBox}>
            <Text style={styles.actionTitle}>GÜNÜN REHBERLİĞİ</Text>
            <Text style={styles.actionText}>{card.action}</Text>
          </View>
          
        </View>
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
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5a4634',
    letterSpacing: 3,
    textAlign: 'center',
    width: '100%',
  },
  messageText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 16,
    color: '#4a3b2c',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 10,
  },
  symbolContainer: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  guideText: {
    fontSize: 15,
    color: '#8c7355',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    flexShrink: 1, // Allows text to wrap within the row if it's too long
  },
  dividerSpacing: {
    marginTop: 10,
    marginBottom: 8,
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
    width: '100%',
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

export default AngelCardSymbol;
