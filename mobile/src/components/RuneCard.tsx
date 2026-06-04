import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, ImageBackground } from 'react-native';
import Svg, { 
  Defs, 
  Rect, 
  Path, 
  G,
  Circle
} from 'react-native-svg';
import { BrandedScrollView } from './BrandedScrollView';

interface RuneCardProps {
  rune: { path: string; keyword: string; message: string; runeName: string };
  width?: number;
}

const RuneCard: React.FC<RuneCardProps> = ({ 
  rune, 
  width = Dimensions.get('window').width * 0.75 
}) => {
  const height = (width * 650) / 400;
  
  return (
    <View style={[styles.container, { width, height }]}>
      <ImageBackground 
        source={require('../../assets/stone_bg.jpg')} 
        style={styles.backgroundImage}
        imageStyle={{ borderRadius: 20 }}
      >
        {/* Dekoratif Çerçeve (Gümüş/Beyaz Tonlarında) */}
        <View style={StyleSheet.absoluteFill}>
          <Svg viewBox="0 0 400 650" width="100%" height="100%">
            <Rect x="20" y="20" width="360" height="610" rx="15" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
            <Path d="M 20 60 L 20 20 L 60 20" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
            <Path d="M 340 20 L 380 20 L 380 60" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
            <Path d="M 20 590 L 20 630 L 60 630" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
            <Path d="M 340 630 L 380 630 L 380 590" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
          </Svg>
        </View>

        {/* İçerik Düzeni */}
        <View style={styles.content}>
          <View style={styles.runeArea}>
            <View style={styles.runeLetterContainer}>
               <Svg width={width * 0.35} height={width * 0.35} viewBox="0 0 100 100">
                  <Path 
                    d={rune.path} 
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    transform="scale(0.7) translate(22, 10)"
                  />
               </Svg>
            </View>
            <Text style={styles.runeName}>{rune.keyword}</Text>
            <Text style={styles.originalName}>({rune.runeName})</Text>
          </View>

          <View style={styles.scrollArea}>
            <BrandedScrollView
              indicatorMode="box"
              style={{ flex: 1 }} 
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled={true}
            >
              <Text style={styles.messageLabel}>TAŞIN MESAJI:</Text>
              <Text style={styles.messageText}>{rune.message}</Text>
            </BrandedScrollView>
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
    paddingHorizontal: 30,
    paddingTop: 55, // Border'dan kaçmak için artırıldı
    paddingBottom: 30,
    alignItems: 'center',
  },
  runeArea: {
    alignItems: 'center',
    marginBottom: 5,
  },
  runeLetterContainer: {
    marginBottom: 0,
    opacity: 0.9,
  },
  runeName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 10,
  },
  originalName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 15,
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 30,
    alignItems: 'center',
    flexGrow: 1,
  },
  messageLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.6)', // Beyaz yapıldı
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 17,
    color: '#ffffff', // Beyaz yapıldı
    textAlign: 'center',
    lineHeight: 26,
    fontStyle: 'italic',
  },
});

export default RuneCard;
