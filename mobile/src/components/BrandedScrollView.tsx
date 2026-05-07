import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = ScrollViewProps & {
  containerStyle?: StyleProp<ViewStyle>;
  indicatorMode?: 'page' | 'box';
  showScrollToTop?: boolean;
};

export const BrandedScrollView = forwardRef<ScrollView, Props>(function BrandedScrollView(
  { children, containerStyle, indicatorMode = 'page', showScrollToTop = false, onScroll, onContentSizeChange, onLayout, ...props },
  forwardedRef,
) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useImperativeHandle(forwardedRef, () => scrollRef.current as ScrollView);

  const canScroll = contentHeight > viewportHeight + 12;
  const trackHeight = Math.max(64, viewportHeight - (indicatorMode === 'page' ? 96 : 20));
  const thumbHeight = canScroll ? Math.max(indicatorMode === 'page' ? 42 : 28, (viewportHeight / contentHeight) * trackHeight) : 0;
  const maxOffset = Math.max(1, contentHeight - viewportHeight);
  const thumbTop = canScroll ? Math.min(trackHeight - thumbHeight, (offsetY / maxOffset) * (trackHeight - thumbHeight)) : 0;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffsetY(Math.max(0, event.nativeEvent.contentOffset.y));
    onScroll?.(event);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <ScrollView
        {...props}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          setContentHeight(height);
          onContentSizeChange?.(width, height);
        }}
      >
        {children}
      </ScrollView>
      {canScroll ? (
        <View
          pointerEvents="none"
          style={[
            styles.rail,
            indicatorMode === 'box' && styles.railBox,
            { height: trackHeight, top: indicatorMode === 'page' ? 18 : 10 },
          ]}
        >
          <View style={[styles.thumb, indicatorMode === 'box' && styles.thumbBox, { height: thumbHeight, top: thumbTop }]} />
        </View>
      ) : null}
      {showScrollToTop && canScroll && offsetY > 120 ? (
        <TouchableOpacity
          style={[styles.toTopButton, { bottom: Math.max(18, insets.bottom + 14) }]}
          activeOpacity={0.82}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Text style={styles.toTopText}>↑</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  rail: {
    position: 'absolute',
    right: 6,
    width: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  railBox: {
    right: 4,
    width: 2,
    backgroundColor: 'rgba(212,165,116,0.2)',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: '#D4A574',
  },
  thumbBox: {
    backgroundColor: '#E8C49A',
  },
  toTopButton: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4A574',
    borderWidth: 1,
    borderColor: 'rgba(255,245,232,0.55)',
  },
  toTopText: {
    color: '#14141E',
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '900',
  },
});
