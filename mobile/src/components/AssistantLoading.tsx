import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type AssistantLoadingProps = {
  label?: string;
  detail?: string;
  compact?: boolean;
};

function AnimatedDots() {
  const values = useRef([new Animated.Value(0.25), new Animated.Value(0.25), new Animated.Value(0.25)]).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.25,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.delay((values.length - index) * 120),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View style={styles.dots}>
      {values.map((value, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity: value, transform: [{ scale: value }] }]} />
      ))}
    </View>
  );
}

export function AssistantLoading({ label = 'Yanıt hazırlanıyor', detail, compact = false }: AssistantLoadingProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.row}>
        <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
        <AnimatedDots />
      </View>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(168,130,82,0.3)',
    backgroundColor: 'rgba(30,30,40,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardCompact: {
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#FFF5E8',
    fontSize: 14,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 13,
  },
  detail: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    lineHeight: 17,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E8C49A',
  },
});
