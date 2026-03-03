import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, Dimensions, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLORS = ['#66BB6A', '#37474F', '#546E7A', '#FFA726', '#EF5350', '#AB47BC', '#29B6F6'];

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  xStart: number;
  color: string;
  size: number;
  isRect: boolean;
}

function createParticle(): Particle {
  const xStart = Math.random() * SCREEN_W;
  return {
    x: new Animated.Value(xStart),
    y: new Animated.Value(-20),
    opacity: new Animated.Value(1),
    rotate: new Animated.Value(0),
    xStart,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    isRect: Math.random() > 0.5,
  };
}

interface ConfettiProps {
  visible: boolean;
}

export function Confetti({ visible }: ConfettiProps) {
  const particles = useRef<Particle[]>(
    Array.from({ length: 30 }, createParticle),
  ).current;

  const anims = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (!visible) return;

    // Reset particles
    particles.forEach((p) => {
      const newX = Math.random() * SCREEN_W;
      p.xStart = newX;
      p.x.setValue(newX);
      p.y.setValue(-20 - Math.random() * 60);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
    });

    const allAnims = particles.map((p) => {
      const duration = 2000 + Math.random() * 1200;
      return Animated.parallel([
        Animated.timing(p.y, {
          toValue: SCREEN_H + 60,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: p.xStart + (Math.random() - 0.5) * 120,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(duration * 0.6),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: duration * 0.4,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    const combined = Animated.stagger(50, allAnims);
    anims.current = [combined];
    combined.start();

    return () => {
      anims.current.forEach((a) => a.stop());
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({
          inputRange: [-720, 720],
          outputRange: ['-720deg', '720deg'],
        });
        return (
          <Animated.View
            key={i}
            style={[
              p.isRect ? styles.rect : styles.circle,
              {
                backgroundColor: p.color,
                width: p.size,
                height: p.isRect ? p.size * 0.5 : p.size,
                borderRadius: p.isRect ? 2 : p.size / 2,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  rect: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
