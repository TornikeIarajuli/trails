import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
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
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { Badge } from '../../types/badge';
import { Dialog } from '../ui/Dialog';
import { useLastVisibleValue } from '../ui/Sheet';
import { BADGE_ICON_MAP } from './badgeConstants';

interface BadgeUnlockModalProps {
  badges: Badge[];
  visible: boolean;
  onClose: () => void;
}

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

  const iconName = BADGE_ICON_MAP[badge.icon] ?? 'ribbon';

  return (
    <View style={styles.cardWrapper}>
      {/* Front face — question mark */}
      <Animated.View style={[styles.flipCard, styles.flipFront, frontStyle]}>
        <Icon name="help" size={52} color="#fff" />
      </Animated.View>

      {/* Back face — badge reveal */}
      <Animated.View style={[styles.flipCard, styles.flipBack, backStyle]}>
        <Icon name={iconName as any} size={52} color="#fff" />
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
  const open = visible && badges.length > 0;
  // The parent usually clears the badges as it closes the dialog; keep them for its way out
  const shown = useLastVisibleValue(badges, open);
  const [index, setIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);

  // Every opening starts at the first badge, from its very first frame
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(0);
  }

  const last = Math.max(0, shown.length - 1);
  const position = Math.min(index, last);
  const current = shown[position];

  const handleNext = () => {
    if (position < last) {
      setIndex(position + 1);
    } else {
      onClose();
    }
  };

  // Only the button closes it, so nobody skips their badges by tapping beside the card
  return (
    <Dialog visible={open} onClose={onClose} closeOnBackdropPress={false} style={styles.modal}>
      {current ? (
        <>
          {shown.length > 1 && (
            <Text style={styles.counter}>{position + 1} / {shown.length}</Text>
          )}
          <FlipCard
            key={current.id}
            badge={current}
            onNext={handleNext}
            isLast={position === last}
            styles={styles}
            Colors={Colors}
          />
        </>
      ) : null}
    </Dialog>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  modal: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
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
