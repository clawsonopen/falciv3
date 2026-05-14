import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  LinearGradient, 
  Stop, 
  Rect, 
  Path, 
  Circle,
  RadialGradient,
  G
} from 'react-native-svg';
import { formatReadableText } from './SelectableFormattedText';

interface MagicSphereCardProps {
  data: { text: string; sign: string };
  width?: number;
}

const MagicSphereCard: React.FC<MagicSphereCardProps> = ({ 
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
          </Svg>
        </View>

        {/* Küre (Orta Üstte) */}
        <View style={styles.sphereContainer}>
           <Svg width="150" height="150" viewBox="0 0 200 200">
             <Defs>
               <RadialGradient id="galaxyGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                 <Stop offset="0%" stopColor="#2c3138" />
                 <Stop offset="100%" stopColor="#0a0c0f" />
               </RadialGradient>
             </Defs>
             
             {/* Kozmik Küre */}
             <Circle cx="100" cy="100" r="60" fill="url(#galaxyGrad)" stroke="#c59b6d" strokeWidth="1.5" />
             
             {/* Yıldız Kümesi (Daha Yoğun) */}
             <G opacity="0.8">
                {[...Array(20)].map((_, i) => (
                  <Circle 
                    key={i} 
                    cx={70 + Math.sin(i * 1.5) * 30} 
                    cy={70 + Math.cos(i * 2.1) * 30} 
                    r={0.5 + Math.random() * 1.5} 
                    fill="#fdf4e3" 
                    opacity={0.4 + Math.random() * 0.6}
                  />
                ))}
             </G>

             {/* Üçüncü Göz Sembolü */}
             <G transform="translate(100, 100) scale(0.8) translate(-100, -100)">
                {/* Göz Kapakları */}
                <Path 
                  d="M60,100 Q100,60 140,100 Q100,140 60,100 Z" 
                  fill="none" 
                  stroke="#e0c296" 
                  strokeWidth="1.5" 
                  opacity="0.9"
                />
                {/* İris */}
                <Circle cx="100" cy="100" r="15" fill="none" stroke="#e0c296" strokeWidth="1.2" />
                {/* Göz Bebeği */}
                <Circle cx="100" cy="100" r="6" fill="#e0c296" />
                {/* Parlama */}
                <Circle cx="103" cy="97" r="2" fill="#ffffff" opacity="0.6" />
             </G>
           </Svg>
        </View>

        {/* İçerik Düzeni */}
        <View style={styles.content}>
          <Text style={styles.mainText}>{formatReadableText(data.text)}</Text>

          <View style={styles.signBox}>
            <Text style={styles.signTitle}>KÜRENİN İŞARETLERİ</Text>
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
  sphereContainer: {
    marginTop: 0, // En yukarı çekildi
    marginBottom: 0,
    alignItems: 'center',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 25,
    paddingTop: 130, // Küre yukarı kaydığı için padding de azaltıldı
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 16,
    color: '#4a3b2c',
    textAlign: 'center',
    lineHeight: 26,
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

export default MagicSphereCard;
