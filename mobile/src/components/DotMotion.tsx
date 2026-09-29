import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export function DotMark({ color, size = 5 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const pulses = useRef([new Animated.Value(0.45), new Animated.Value(0.45), new Animated.Value(0.45)]).current;

  useEffect(() => {
    if (reduced) {
      pulses.forEach((pulse) => pulse.setValue(1));
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.stagger(
          150,
          pulses.map((pulse) =>
            Animated.sequence([
              Animated.timing(pulse, { toValue: 1, duration: 280, useNativeDriver: true }),
              Animated.timing(pulse, { toValue: 0.45, duration: 380, useNativeDriver: true }),
            ]),
          ),
        ),
        Animated.delay(1000),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulses, reduced]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mark, { gap: size * 0.6 }]}>
      {Array.from({ length: 9 }, (_, index) => {
        const pulseIndex = [0, 4, 8].indexOf(index);
        return (
          <Animated.View
            key={index}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: pulseIndex >= 0 ? pulses[pulseIndex] : 0.18,
            }}
          />
        );
      })}
    </View>
  );
}

export function DotReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 23,
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
