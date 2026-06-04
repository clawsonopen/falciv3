import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { getTarotDeckImages } from '../data/tarotImageMap';

const BORDER_IMAGE = require('../../assets/border.png');

type Props = {
  cardName: string;
  isReversed: boolean;
  nonce: number;
  deckId?: string | null;
};

export function TarotRevealCard({ cardName, isReversed, nonce, deckId }: Props) {
  const flip = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0.88)).current;

  const deckImages = useMemo(() => getTarotDeckImages(deckId), [deckId]);
  const frontImage = useMemo(() => deckImages.front[cardName] || deckImages.back, [cardName, deckImages]);

  useEffect(() => {
    flip.setValue(0);
    zoom.setValue(0.88);
    Animated.parallel([
      Animated.timing(flip, {
        toValue: 1,
        duration: 1080,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(zoom, {
          toValue: 1.07,
          duration: 430,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(zoom, {
          toValue: 1,
          duration: 330,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [cardName, flip, nonce, zoom]);

  const backRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const frontRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.cardFrame, { transform: [{ scale: zoom }] }]}>
        <Animated.View
          style={[
            styles.cardFace,
            {
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
            },
          ]}
        >
          <Image source={deckImages.back} style={styles.cardImage} resizeMode="cover" />
          <Image source={BORDER_IMAGE} style={styles.borderOverlay} resizeMode="stretch" />
        </Animated.View>

        <Animated.View
          style={[
            styles.cardFace,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
            },
          ]}
        >
          <Image
            source={frontImage}
            style={[styles.cardImage, isReversed ? styles.reversedImage : null]}
            resizeMode="cover"
          />
          <Image source={BORDER_IMAGE} style={styles.borderOverlay} resizeMode="stretch" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFrame: {
    width: 164,
    height: 276,
    borderRadius: 14,
    backgroundColor: '#000',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    backgroundColor: '#1A1A24',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  reversedImage: {
    transform: [{ rotate: '180deg' }],
  },
});
