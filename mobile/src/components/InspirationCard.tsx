import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground, Animated, Easing } from 'react-native';
import Svg, { 
  Rect, 
  Path, 
  Defs,
  LinearGradient,
  Stop
} from 'react-native-svg';
import { BrandedScrollView } from './BrandedScrollView';
import { formatReadableText } from './SelectableFormattedText';

interface InspirationCardProps {
  text: string;
  width?: number;
}

const InspirationCard: React.FC<InspirationCardProps> = ({ 
  text,
  width = Dimensions.get('window').width * 0.85 
}) => {
  const height = (width * 650) / 400;
  
  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);
  
  return (
    <View style={[styles.container, { width, height }]}>
      <ImageBackground 
        source={require('../../assets/parchment_bg.jpg')} 
        style={styles.backgroundImage}
        imageStyle={{ borderRadius: 10 }}
      >
        {/* Dekoratif Çerçeve */}
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="0 0 400 650" width="100%" height="100%">
            <Rect x="20" y="20" width="360" height="610" rx="4" fill="none" stroke="#5a4634" strokeWidth="1" opacity="0.3" />
            <Path d="M20,60 L20,20 L60,20" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M340,20 L380,20 L380,60" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M20,590 L20,630 L60,630" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M340,630 L380,630 L380,590" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
          </Svg>
        </View>

        {/* İçerik Düzeni */}
        <View style={styles.content}>
          <View style={styles.iconArea}>
            <Svg width="40" height="40" viewBox="0 0 24 24" opacity="0.6">
              <Path 
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" 
                fill="#5a4634" 
              />
            </Svg>
          </View>

          <View style={styles.scrollContent}>
            <BrandedScrollView
              indicatorMode="box"
              style={{ flex: 1 }} 
              contentContainerStyle={styles.scrollContainer}
            >
              <Text style={styles.messageText}>
                {formatReadableText(text)}
              </Text>
            </BrandedScrollView>
            
            {/* Alt Gradyan (Fade) */}
            <View style={styles.gradientOverlay} pointerEvents="none">
              <Svg height="40" width="100%">
                <Defs>
                  <LinearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#fdf4e3" stopOpacity="0" />
                    <Stop offset="1" stopColor="#fdf4e3" stopOpacity="0.8" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="40" fill="url(#fadeGrad)" />
              </Svg>
            </View>

            {/* Zıplayan Ok */}
            <Animated.View 
              style={[
                styles.scrollIndicator,
                {
                  transform: [{
                    translateY: bounceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 5]
                    })
                  }]
                }
              ]}
              pointerEvents="none"
            >
              <Svg width="20" height="20" viewBox="0 0 24 24">
                <Path 
                  d="M7 10l5 5 5-5" 
                  fill="none" 
                  stroke="#5a4634" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  opacity="0.6"
                />
              </Svg>
            </Animated.View>
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
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 25,
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
  },
  iconArea: {
    marginBottom: 30,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  scrollContainer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  messageText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 18,
    color: '#4a3b2c',
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
  },
});

export default InspirationCard;
