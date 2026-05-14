import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  LinearGradient, 
  Stop, 
  Rect, 
  Path, 
  Circle,
  Ellipse,
  G,
  Text as SvgText
} from 'react-native-svg';
import { formatReadableText } from './SelectableFormattedText';

interface FortuneCookieCardProps {
  data: { text: string; sign: string };
  width?: number;
}

const FortuneCookieCard: React.FC<FortuneCookieCardProps> = ({ 
  data, 
  width = Dimensions.get('window').width * 0.75 
}) => {
  const height = (width * 650) / 400;
  
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
            <Path d="M 15 45 L 15 15 L 45 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 385 45 L 385 15 L 355 15" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 15 605 L 15 635 L 45 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
            <Path d="M 385 605 L 385 635 L 355 635" fill="none" stroke="url(#goldGrad)" strokeWidth="3" />
          </Svg>
        </View>

        {/* İçerik Düzeni */}
        <View style={styles.content}>
          <View style={styles.cookieIcon}>
             <Svg width="140" height="100" viewBox="0 0 140 100">
                <Defs>
                  <LinearGradient id="cookieGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#e8c296" />
                    <Stop offset="100%" stopColor="#b38b5d" />
                  </LinearGradient>
                  <LinearGradient id="paperGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#ffffff" />
                    <Stop offset="100%" stopColor="#f0f0f0" />
                  </LinearGradient>
                </Defs>
                
                {/* Ana Kırık Parça (Sol) */}
                <Path 
                  d="M45,20 C15,20 5,45 10,65 C15,85 45,95 65,85 C70,82 75,70 70,55 C68,45 60,35 45,20 Z" 
                  fill="url(#cookieGrad)" 
                  stroke="#8c7355" 
                  strokeWidth="1"
                />
                
                {/* Küçük Kırık Parça (Sağ) */}
                <Path 
                  d="M95,45 C115,45 125,60 120,75 C115,85 100,88 90,80 C85,75 88,60 95,45 Z" 
                  fill="url(#cookieGrad)" 
                  stroke="#8c7355" 
                  strokeWidth="1"
                />
                
                {/* Kağıt Şeridi */}
                <Path 
                  d="M60,45 L115,35 L118,55 L63,65 Z" 
                  fill="url(#paperGrad)" 
                  stroke="#d0d0d0" 
                  strokeWidth="0.5"
                />
                
                {/* Kağıt Üzerindeki Yazı (ŞANS KURABİYESİ) */}
                <G transform="rotate(-10, 88, 48)">
                   <SvgText 
                     x="88" 
                     y="52" 
                     fill="#e63946" 
                     fontSize="7" 
                     fontWeight="bold" 
                     textAnchor="middle"
                     fontFamily="monospace"
                   >
                     ŞANS KURABİYESİ
                   </SvgText>
                </G>

                {/* Kırıntılar */}
                <Circle cx="80" cy="80" r="1.5" fill="#b38b5d" />
                <Circle cx="85" cy="75" r="1" fill="#e8c296" />
                <Circle cx="75" cy="85" r="0.8" fill="#8c7355" />
             </Svg>
          </View>

          <Text style={styles.mainText}>{formatReadableText(data.text)}</Text>

          <View style={styles.signBox}>
            <Text style={styles.signTitle}>GÜNÜN UĞURLU ÜÇLEMESİ</Text>
            <Text style={styles.signText}>{formatReadableText(data.sign)}</Text>
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
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookieIcon: {
    marginBottom: 20,
    opacity: 0.9,
  },
  mainText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 17,
    color: '#4a3b2c',
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
    marginBottom: 40,
  },
  signBox: {
    backgroundColor: 'rgba(253, 244, 227, 0.85)',
    borderWidth: 1,
    borderColor: '#e0c296',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
  },
  signTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8c7355',
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  signText: {
    fontSize: 13,
    color: '#5a4634',
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default FortuneCookieCard;
