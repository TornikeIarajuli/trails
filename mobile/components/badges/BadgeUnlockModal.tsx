import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Badge } from '../../types/badge';

interface BadgeUnlockModalProps {
  badges: Badge[];
  visible: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, string> = {
  footsteps: 'footsteps',
  compass: 'compass',
  flame: 'flame',
  trophy: 'trophy',
  leaf: 'leaf',
  flag: 'flag',
  rocket: 'rocket',
  snow: 'snow',
  'trail-sign': 'trail-sign',
  wine: 'wine',
  camera: 'camera',
  megaphone: 'megaphone',
  bookmark: 'bookmark',
  star: 'star',
  ribbon: 'ribbon',
};

function FlipCard({ badge, onNext, isLast, styles, Colors }: {
  badge: Badge;
  onNext: () => void;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const flipVal = useSharedValue(0);
  const scaleVal = useSharedValue(0);

  useEffect(() => {
    scaleVal.value = withSpring(1, { damping: 14, stiffness: 200 });
    flipVal.value = withDelay(400, withSpring(180, { damping: 14, stiffness: 120 }));
  }, [badge.id]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipVal.value, [0, 90], [0, 90], Extrapolation.CLAMP);
    const opacity = flipVal.value < 90 ? 1 : 0;
    return {
      transform: [{ rotateY: `${rotateY}deg` }, { scale: scaleVal.value }],
      opacity,
      backfaceVisibility: 'hidden',
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipVal.value, [90, 180], [270, 360], Extrapolation.CLAMP);
    const opacity = flipVal.value >= 90 ? 1 : 0;
    return {
      transform: [{ rotateY: `${rotateY}deg` }, { scale: scaleVal.value }],
      opacity,
      backfaceVisibility: 'hidden',
    };
  });

  const iconName = ICON_MAP[badge.icon] ?? 'ribbon';

  return (
    <View style={styles.cardWrapper}>
      {/* Front face — question mark */}
      <Animated.View style={[styles.flipCard, styles.flipFront, frontStyle]}>
        <Ionicons name="help" size={52} color="#fff" />
      </Animated.View>

      {/* Back face — badge reveal */}
      <Animated.View style={[styles.flipCard, styles.flipBack, backStyle]}>
        <Ionicons name={iconName as any} size={52} color="#fff" />
      </Animated.View>

      <Text style={styles.celebration}>Badge Unlocked!</Text>
      <Text style={styles.badgeName}>{badge.name_en}</Text>
      <Text style={styles.badgeDescription}>{badge.description_en}</Text>

      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>{isLast ? 'Awesome!' : 'Next Badge'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function BadgeUnlockModal({ badges, visible, onClose }: BadgeUnlockModalProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const handleNext = () => {
    if (index < badges.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  };

  if (!visible || badges.length === 0) return null;

  const current = badges[index];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {badges.length > 1 && (
            <Text style={styles.counter}>{index + 1} / {badges.length}</Text>
          )}
          <FlipCard
            key={current.id}
            badge={current}
            onNext={handleNext}
            isLast={index === badges.length - 1}
            styles={styles}
            Colors={Colors}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '82%',
    maxWidth: 340,
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  cardWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  flipCard: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    position: 'absolute',
  },
  flipFront: {
    backgroundColor: Colors.textSecondary,
  },
  flipBack: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
  },
  celebration: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 140,
    marginBottom: 10,
  },
  badgeName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  badgeDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginTop: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
