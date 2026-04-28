// ============================================================
// FALCI — SessionTimer Component
// Prominent countdown display with wind-down visual warning
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WIND_DOWN_THRESHOLD } from '../config/constants';

interface SessionTimerProps {
  remainingSeconds: number;
  formatTime: (seconds: number) => string;
}

export function SessionTimer({ remainingSeconds, formatTime }: SessionTimerProps) {
  const isWindingDown = remainingSeconds <= WIND_DOWN_THRESHOLD && remainingSeconds > 0;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isWindingDown) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isWindingDown, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        isWindingDown && styles.containerWarning,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Text style={styles.label}>⏱️</Text>
      <Text
        style={[
          styles.time,
          isWindingDown && styles.timeWarning,
          remainingSeconds <= 0 && styles.timeExpired,
        ]}
      >
        {formatTime(remainingSeconds)}
      </Text>
      {isWindingDown && (
        <Text style={styles.warningText}>Toparlıyorum...</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 130, 82, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 130, 82, 0.3)',
  },
  containerWarning: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  label: {
    fontSize: 16,
  },
  time: {
    fontSize: 36,
    fontWeight: '700',
    color: '#D4A574',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timeWarning: {
    color: '#FF6B6B',
  },
  timeExpired: {
    color: '#666',
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 2,
    fontStyle: 'italic',
  },
});
