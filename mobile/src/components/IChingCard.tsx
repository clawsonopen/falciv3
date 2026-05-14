import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground, Animated, Easing } from 'react-native';
import Svg, { 
  Defs, 
  Rect, 
  Path, 
  G,
  Circle,
  Text as SvgText,
  LinearGradient,
  Stop
} from 'react-native-svg';
import { BrandedScrollView } from './BrandedScrollView';
import IChingSymbol from './IChingSymbol';
import { formatReadableText } from './SelectableFormattedText';

interface IChingCardProps {
  data: {
    baseLines: number[];
    hasChanges: boolean;
    endLines: number[];
    baseHexName: string;
    endHexName?: string;
    text: string;
  };
  width?: number;
}

const IChingCard: React.FC<IChingCardProps> = ({ 
  data, 
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
        {/* Dekoratif "Eski Fırça" Çerçeve */}
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="0 0 400 650" width="100%" height="100%">
            <Rect x="20" y="20" width="360" height="610" rx="4" fill="none" stroke="#5a4634" strokeWidth="1" opacity="0.3" />
            <Path d="M20,60 L20,20 L60,20" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M340,20 L380,20 L380,60" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M20,590 L20,630 L60,630" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            <Path d="M340,630 L380,630 L380,590" fill="none" stroke="#5a4634" strokeWidth="2" opacity="0.6" />
            
            {/* "Mühür" (Red Stamp) - Merkezi Alt Çizgi Üzerinde */}
            <G transform="translate(180, 610)">
              <Rect x="0" y="0" width="40" height="40" fill="#a62c2b" opacity="0.8" rx="2" />
              <SvgText x="20" y="26" fill="#fdf4e3" fontSize="14" fontWeight="bold" textAnchor="middle">易經</SvgText>
            </G>
          </Svg>
        </View>

        {/* İçerik Düzeni */}
        <View style={styles.content}>
          <View style={styles.symbolArea}>
             <View style={styles.symbolContainer}>
                <IChingSymbol lines={data.baseLines} size={width * 0.16} color="#2c2c2c" />
                <View style={styles.hexNameBox}>
                   {data.baseHexName.split(' / ').map((part, idx) => (
                     <Text key={idx} style={[styles.hexName, idx === 1 && styles.hexTranslation]}>{part}</Text>
                   ))}
                </View>
             </View>

             {data.hasChanges && (
               <>
                 <Text style={styles.arrow}>→</Text>
                  <View style={styles.symbolContainer}>
                    <IChingSymbol lines={data.endLines} size={width * 0.16} color="#a62c2b" />
                    <View style={styles.hexNameBox}>
                       {data.endHexName?.split(' / ').map((part, idx) => (
                         <Text key={idx} style={[styles.hexName, { color: '#a62c2b' }, idx === 1 && styles.hexTranslation]}>{part}</Text>
                       ))}
                    </View>
                  </View>
               </>
             )}
          </View>

          <View style={styles.scrollContent}>
            <BrandedScrollView
              indicatorMode="box"
              style={{ flex: 1 }} 
              contentContainerStyle={styles.scrollContainer}
            >
              <Text style={styles.messageText}>
                {formatReadableText(data.text.split('\n\n').slice(1).join('\n\n'))}
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
    paddingHorizontal: 30,
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  symbolArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 30,
    marginTop: 20,
  },
  symbolContainer: {
    alignItems: 'center',
    gap: 10,
  },
  hexNameBox: {
    alignItems: 'center',
    marginTop: 4,
  },
  hexName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c2c2c',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hexTranslation: {
    fontSize: 10,
    fontWeight: 'normal',
    opacity: 0.8,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: '#8c7355',
    opacity: 0.5,
    marginTop: -20, // Sembollerin yanına daha iyi ortalamak için
  },
  scrollContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  scrollContainer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  messageText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 17,
    color: '#4a3b2c',
    textAlign: 'center',
    lineHeight: 26,
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

export default IChingCard;
