import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';
import { FeedItem, ActivityType } from '../../types/feed';

const ACTION_CONFIG: Record<ActivityType, { verb: string; icon: string; color: string }> = {
  completion: { verb: 'completed', icon: 'checkmark-circle', color: Colors.success },
  photo: { verb: 'uploaded a photo on', icon: 'camera', color: '#2196F3' },
  condition: { verb: 'reported a condition on', icon: 'warning', color: '#FF9800' },
  review: { verb: 'reviewed', icon: 'star', color: '#FFC107' },
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getConditionLabel(conditionType: string): string {
  const labels: Record<string, string> = {
    trail_clear: 'Trail Clear',
    muddy: 'Muddy',
    snow: 'Snow',
    fallen_tree: 'Fallen Tree',
    flooded: 'Flooded',
    overgrown: 'Overgrown',
    damaged: 'Damaged',
    closed: 'Closed',
  };
  return labels[conditionType] || conditionType;
}

export function ActivityCard({ item }: { item: FeedItem }) {
  const config = ACTION_CONFIG[item.activity_type];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={() => router.push(`/trail/user/${item.user_id}`)}
      >
        <Avatar
          uri={item.user_avatar_url}
          name={item.user_full_name || item.user_username}
          size={44}
        />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText} numberOfLines={2}>
            <Text
              style={styles.username}
              onPress={() => router.push(`/trail/user/${item.user_id}`)}
            >
              {item.user_username}
            </Text>
            {' '}{config.verb}{' '}
            <Text
              style={styles.trailName}
              onPress={() => router.push(`/trail/${item.trail_id}`)}
            >
              {item.trail_name_en}
            </Text>
          </Text>
          <Text style={styles.timestamp}>{getRelativeTime(item.created_at)}</Text>
        </View>

        {/* Extra context based on type */}
        {item.activity_type === 'condition' && item.extra_text && (
          <View style={[styles.conditionBadge, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.conditionText, { color: config.color }]}>
              {getConditionLabel(item.extra_text)}
            </Text>
          </View>
        )}

        {item.activity_type === 'review' && item.extra_text && (
          <View style={styles.ratingRow}>
            {Array.from({ length: parseInt(item.extra_text) || 0 }).map((_, i) => (
              <Ionicons key={i} name="star" size={14} color="#FFC107" />
            ))}
          </View>
        )}

        {/* Photo thumbnail */}
        {item.photo_url && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/trail/${item.trail_id}`)}
          >
            <Image source={{ uri: item.photo_url }} style={styles.photo} />
          </TouchableOpacity>
        )}

        {/* Trail cover as fallback for completions/reviews without photo */}
        {!item.photo_url && item.trail_cover_image_url && item.activity_type === 'completion' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/trail/${item.trail_id}`)}
          >
            <Image source={{ uri: item.trail_cover_image_url }} style={styles.photo} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatarContainer: {
    paddingTop: 2,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
    color: Colors.text,
  },
  trailName: {
    fontWeight: '600',
    color: Colors.primary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: Colors.borderLight,
  },
});
