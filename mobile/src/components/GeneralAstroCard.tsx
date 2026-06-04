import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground, Animated, Easing } from 'react-native';
import Svg, { 
  Rect, 
  Path, 
  G,
  Defs,
  LinearGradient,
  Stop,
  Circle
} from 'react-native-svg';
import { BrandedScrollView } from './BrandedScrollView';
import { formatReadableText } from './SelectableFormattedText';

interface GeneralAstroCardProps {
  title: string;
  text: string;
  width?: number;
}

const GeneralAstroCard: React.FC<GeneralAstroCardProps> = ({ 
  title,
  text,
  width = Dimensions.get('window').width * 0.85 
}) => {
  const height = (width * 650) / 400; // Tarot kartı ile aynı oran
  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  // Metni paragraflara ayırıp başlıkları kalınlaştıran yardımcı fonksiyon
  const renderFormattedText = (rawText: string) => {
    const lines = formatReadableText(rawText).split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={`space-${index}`} style={{ height: 12 }} />;
      
      const parts = trimmed.split(/^(Gökyüzü:|Ana tema:|İlişkiler:|Kariyer ve Finans:|Enerji:|Öneri:)/i);
      
      if (parts.length > 1) {
        return (
          <Text key={index} style={styles.paragraph}>
            <Text style={styles.label}>{parts[1]}</Text>
            <Text style={styles.content}> {parts[2]}</Text>
          </Text>
        );
      }
      
      if (line.includes('Burcu için')) {
        return <Text key={index} style={styles.titleInCard}>{line}</Text>;
      }

      return <Text key={index} style={styles.content}>{line}</Text>;
    });
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <ImageBackground 
        source={require('../../assets/cosmic_astrology_bg.jpg')} 
        style={styles.backgroundImage}
        imageStyle={{ borderRadius: 10 }}
      >
        {/* Dekoratif Kozmik Çerçeve */}
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="0 0 400 650" width="100%" height="100%">
            <Rect x="15" y="15" width="370" height="620" rx="10" fill="none" stroke="#E8C49A" strokeWidth="1" opacity="0.15" />
            
            {/* Köşe Süslemeleri */}
            <G opacity="0.4">
              <Circle cx="30" cy="30" r="1.5" fill="#E8C49A" />
              <Circle cx="370" cy="30" r="1.5" fill="#E8C49A" />
              <Circle cx="30" cy="620" r="1.5" fill="#E8C49A" />
              <Circle cx="370" cy="620" r="1.5" fill="#E8C49A" />
            </G>
          </Svg>
        </View>

        {/* Glassmorphism İçerik Alanı */}
        <View style={styles.glassContainer}>
          <BrandedScrollView
            indicatorMode="box"
            style={styles.scroll} 
            contentContainerStyle={styles.scrollContent}
          >
            {renderFormattedText(text)}
          </BrandedScrollView>

          {/* Alt Fade Efekti */}
          <View style={styles.fadeOverlay} pointerEvents="none">
            <Svg height="50" width="100%">
              <Defs>
                <LinearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#14141E" stopOpacity="0" />
                  <Stop offset="1" stopColor="#14141E" stopOpacity="0.7" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="50" fill="url(#fadeGrad)" />
            </Svg>
          </View>

          {/* Zıplayan Ok Göstergesi */}
          <Animated.View 
            style={[
              styles.indicator,
              {
                transform: [{
                  translateY: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 6]
                  })
                }]
              }
            ]}
          >
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M7 10l5 5 5-5" stroke="#E8C49A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            </Svg>
          </Animated.View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0A0A12',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  glassContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginVertical: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 20, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(232, 196, 154, 0.12)',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleInCard: {
    color: '#E8C49A',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 0.3,
  },
  paragraph: {
    marginBottom: 12,
  },
  label: {
    color: '#D4A574',
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  indicator: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
  }
});

export default GeneralAstroCard;
