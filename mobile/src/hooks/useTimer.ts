// ============================================================
// FALCI — useTimer Hook
// Countdown timer with wind-down warning
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { WIND_DOWN_THRESHOLD } from '../config/constants';

interface UseTimerReturn {
  remainingSeconds: number;
  isWindingDown: boolean;
  isExpired: boolean;
  startTimer: (durationSeconds: number) => void;
  primeTimer: (durationSeconds: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  formatTime: (seconds: number) => string;
}

export function useTimer(
  onWindDown?: () => void,
  onExpired?: () => void,
): UseTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windDownFired = useRef(false);
  const expiredFired = useRef(false);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startTimer = useCallback(
    (durationSeconds: number) => {
      stopTimer();
      setRemainingSeconds(durationSeconds);
      windDownFired.current = false;
      expiredFired.current = false;
      setIsRunning(true);
    },
    [stopTimer],
  );

  const primeTimer = useCallback(
    (durationSeconds: number) => {
      stopTimer();
      setRemainingSeconds(Math.max(0, durationSeconds));
      windDownFired.current = false;
      expiredFired.current = false;
    },
    [stopTimer],
  );

  const pauseTimer = useCallback(() => {
    if (!isRunning) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, [isRunning]);

  const resumeTimer = useCallback(() => {
    if (isRunning) return;
    if (remainingSeconds <= 0) return;
    setIsRunning(true);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;

        // Wind-down warning
        if (
          next <= WIND_DOWN_THRESHOLD &&
          next > 0 &&
          !windDownFired.current
        ) {
          windDownFired.current = true;
          onWindDown?.();
        }

        // Timer expired
        if (next <= 0 && !expiredFired.current) {
          expiredFired.current = true;
          onExpired?.();
        }

        return Math.max(0, next);
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onWindDown, onExpired]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    remainingSeconds,
    isWindingDown: remainingSeconds <= WIND_DOWN_THRESHOLD && remainingSeconds > 0,
    isExpired: remainingSeconds <= 0 && isRunning,
    startTimer,
    primeTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    formatTime,
  };
}
