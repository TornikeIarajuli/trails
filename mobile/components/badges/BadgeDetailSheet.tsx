import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../constants/colors';
import { Badge, BadgeCategory } from '../../types/badge';
import { formatDate } from '../../utils/formatters';

const ICON_MAP: Record<string, string> = {
  footsteps: 'footsteps', compass: 'compass', flame: 'flame', trophy: 'trophy',
  leaf: 'leaf', flag: 'flag', rocket: 'rocket', snow: 'snow',
  'trail-sign': 'trail-sign', wine: 'wine', camera: 'camera',
  megaphone: 'megaphone', bookmark: 'bookmark', star: 'star', ribbon: 'ribbon',
};

const CATEGORY_COLOR: Record<BadgeCategory, string> = {
  completions: '#F59E0B',
  difficulty:  '#EF4444',
  region:      '#3B82F6',
  streak:      '#8B5CF6',
  special:     '#10B981',
};

const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  completions: 'Trail Completions',
  difficulty:  'Difficulty Challenge',
  region:      'Regional Explorer',
  streak:      'Streak',
  special:     'Special Achievement',
};

interface Props {
  badge: Badge | null;
  earned: boolean;
  earnedAt?: string | null;
  progress?: { current: number; target: number } | null;
  onClose: () => void;
}

export function BadgeDetailSheet({ badge, earned, earnedAt, progress, onClose }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  if (!badge) return null;

  const iconName = ICON_MAP[badge.icon] ?? 'ribbon';
  const color = CATEGORY_COLOR[badge.category] ?? Colors.primary;
  const pct = progress ? Math.round((progress.current / progress.target) * 100) : 0;

  const handleShare = async () => {
    await Share.share({
      message: `🏆 I earned the "${badge.name_en}" badge on GZA Trails!\n${badge.description_en}`,
    });
  };

  return (
    <Modal visible={!!badge} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: earned ? color : Colors.borderLight }]}>
          <Ionicons name={iconName as any} size={40} color={earned ? '#fff' : Colors.textLight} />
          {!earned && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color={Colors.textLight} />
            </View>
          )}
        </View>

        {/* Category pill */}
        <View style={[styles.categoryPill, { backgroundColor: color + '20' }]}>
          <Text style={[styles.categoryText, { color }]}>
            {CATEGORY_LABEL[badge.category]}
          </Text>
        </View>

        {/* Name + description */}
        <Text style={styles.name}>{badge.name_en}</Text>
        <Text style={styles.description}>{badge.description_en}</Text>

        {/* Earned date or progress */}
        {earned && earnedAt ? (
          <View style={[styles.statusRow, { backgroundColor: Colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={[styles.statusText, { color: Colors.success }]}>
              Earned {formatDate(earnedAt)}
            </Text>
          </View>
        ) : progress ? (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={[styles.progressPct, { color }]}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.progressCount}>
              {progress.current} / {progress.target}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        {earned && (
          <TouchableOpacity style={[styles.shareBtn, { borderColor: color }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={color} />
            <Text style={[styles.shareBtnText, { color }]}>Share Badge</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    alignItems: 'center',
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  lockBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    width: '100%',
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressCount: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
