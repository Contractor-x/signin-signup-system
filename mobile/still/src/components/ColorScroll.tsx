import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';

type ColorScrollProps = ScrollViewProps & {
  children: React.ReactNode;
  thumbColor?: string;
  trackColor?: string;
};

/**
 * A ScrollView with a slim, always-visible scrollbar in the STILL blue.
 * React Native does not expose the Android scrollbar tint, so we draw the
 * thumb ourselves; it also looks the same on every Android navigation mode.
 *
 * Performance notes:
 * - contentHeight / viewHeight are stored in refs (not state) so scrolling
 *   never triggers a React re-render of the product grid.
 * - The scrollbar thumb is driven by an Animated.Value, so it moves at 60fps
 *   without JS round-trips.
 * - scrollbar visibility toggles only when content/layout changes, not on
 *   every scroll event.
 */
export function ColorScroll({
  children,
  thumbColor = 'rgba(16, 18, 16, 0.38)',
  trackColor = 'rgba(16, 18, 16, 0.07)',
  onScroll,
  onContentSizeChange,
  onLayout,
  ...rest
}: ColorScrollProps) {
  const contentHeightRef = useRef(0);
  const viewHeightRef = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showScrollbar, setShowScrollbar] = useState(false);

  const trackInset = 8;

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentHeightRef.current = height;
      onContentSizeChange?.(width, height);
      // Only toggle visibility when content actually changes size.
      setShowScrollbar((prev) => {
        const next = height > 0; // will be compared against viewHeight on layout
        return next;
      });
    },
    [onContentSizeChange],
  );

  const handleLayout = useCallback(
    (event: any) => {
      const h = event.nativeEvent.layout.height;
      viewHeightRef.current = h;
      onLayout?.(event);
      setShowScrollbar((prev) => {
        const next = contentHeightRef.current > h + 4;
        return next;
      });
    },
    [onLayout],
  );

  const trackHeight = Math.max(0, viewHeightRef.current - trackInset * 2);
  const thumbHeight =
    contentHeightRef.current > 0 && viewHeightRef.current > 0
      ? Math.min(trackHeight, 76, Math.max(28, (viewHeightRef.current / contentHeightRef.current) * trackHeight))
      : 0;
  const maxScroll = Math.max(0, contentHeightRef.current - viewHeightRef.current);
  const maxTravel = Math.max(0, trackHeight - thumbHeight);

  // Drive the thumb with an Animated value instead of React state so scrolling
  // never re-renders the product grid.
  const thumbTranslate = scrollY.interpolate({
    inputRange: [0, maxScroll || 1],
    outputRange: [0, maxTravel],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: onScroll ? (event: any) => onScroll(event) : undefined,
    },
  );

  if (!showScrollbar || thumbHeight === 0) {
    return (
      <ScrollView
        {...rest}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        {...rest}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
      >
        {children}
      </ScrollView>

      <View pointerEvents="none" style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              height: thumbHeight,
              backgroundColor: thumbColor,
              transform: [{ translateY: thumbTranslate }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  track: {
    position: 'absolute',
    right: 3,
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 4,
    borderRadius: 2,
  },
});
