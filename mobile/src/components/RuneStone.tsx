import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Defs, Filter, FeOffset, FeGaussianBlur, FeComposite, FeFlood, LinearGradient, Stop, G } from 'react-native-svg';

// Path animasyonu için Svg Path'i Animated bileşenine dönüştürüyoruz
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface RuneStoneProps {
  path: string;
  size?: number;
  glowColor?: string;
}

const RuneStone: React.FC<RuneStoneProps> = ({ 
  path, 
  size = 220, 
  glowColor = '#ff9d00' 
}) => {
  const glowOpacity = useRef(new Animated.Value(0.1)).current;
  const drawProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Işığın nefes alma animasyonu - Performans için 2 saniyelik periyot
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.9,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Sembolün çizilme animasyonu
    Animated.timing(drawProgress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [path]);

  // StrokeDashoffset'i animasyonlu hale getiriyoruz
  const strokeDashoffset = drawProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size * 1.3 }]}>
      {/* Arka Plan Glow - Android performansı için shadowRadius optimize edildi */}
      <Animated.View style={[
        styles.glowLayer, 
        { 
            width: size * 0.75, 
            height: size * 0.95, 
            backgroundColor: glowColor,
            shadowColor: glowColor,
            shadowRadius: Platform.OS === 'ios' ? 35 : 15,
            shadowOpacity: 0.8,
            elevation: Platform.OS === 'ios' ? 0 : 12,
            opacity: glowOpacity,
        }
      ]} />
      
      <Svg width={size} height={size * 1.3} viewBox="0 0 100 150">
        <Defs>
          <LinearGradient id="stoneGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#454b57" />
            <Stop offset="0.5" stopColor="#1c1f26" />
            <Stop offset="1" stopColor="#0a0c0f" />
          </LinearGradient>

          {/* Oyulmuş Efekt Filtresi - Android performansı için blur yumuşatıldı */}
          <Filter id="carvedEffect" x="-10%" y="-10%" width="120%" height="120%">
            <FeFlood floodColor="#000" floodOpacity="0.8" result="black" />
            <FeComposite operator="out" in="SourceGraphic" in2="black" result="inverse" />
            <FeOffset dx="0.5" dy="0.5" result="offset" />
            <FeGaussianBlur stdDeviation={Platform.OS === 'ios' ? 1.2 : 0.6} result="blur" />
            <FeComposite operator="in" in="blur" in2="inverse" result="shadow" />
            <FeComposite operator="over" in="shadow" in2="SourceGraphic" />
          </Filter>
        </Defs>

        {/* Taşın Kendisi */}
        <Path
          d="M 50 10 C 15 10 2 30 7 75 C 12 120 25 140 50 140 C 75 140 88 120 93 75 C 98 30 85 10 50 10 Z"
          fill="url(#stoneGrad)"
          stroke="#000"
          strokeWidth="0.5"
        />

        {/* Rün Sembolü - Ortalandı ve hizalandı */}
        <G transform="translate(0, 5) scale(0.95)">
          <AnimatedPath
            d={path}
            stroke={glowColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="700"
            strokeDashoffset={strokeDashoffset}
            filter="url(#carvedEffect)"
          />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  glowLayer: {
    position: 'absolute',
    borderRadius: 120,
    zIndex: -1,
  }
});

export default RuneStone;
