import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { useColors, ColorPalette } from '../../constants/colors';
import type { TrailEvent } from '../../services/events';
import { hasJoined, hikeDateLabel, participantCount, spotsLeft } from '../../utils/groupHikes';
import { haptics } from '../../utils/haptics';

interface GroupHikeCardProps {
  event: TrailEvent;
  userId: string | null | undefined;
  /** "card": Explore's sideways row; "row": the full list. */
  variant?: 'card' | 'row';
}

/** A group hike: when, where, who organizes it and how many are going. Opens the hike. */
export function GroupHikeCard({ event, userId, variant = 'row' }: GroupHikeCardProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const going = participantCount(event);
  const left = spotsLeft(event);
  const joined = hasJoined(event, userId);
  const trail = event.trails;
  const where = [trail?.name_en, trail?.region].filter(Boolean).join(' · ');
  const when = hikeDateLabel(event.scheduled_at);
  const status = joined ? null : left === 0 ? 'Full' : left !== null && left <= 3 ? `${left} ${left === 1 ? 'spot' : 'spots'} left` : null;

  const open = () => {
    haptics.tap();
    router.push(`/trail/${event.trail_id}/event/${event.id}` as never);
  };

  const cover = trail?.cover_image_url ? (
    <Image source={{ uri: trail.cover_image_url }} style={variant === 'card' ? styles.cardCover : styles.rowCover} cachePolicy="memory-disk" transition={150} />
  ) : (
    <View style={[variant === 'card' ? styles.cardCover : styles.rowCover, styles.coverPlaceholder]}>
      <Icon name="people-outline" size={variant === 'card' ? 28 : 22} color={Colors.textLight} />
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {event.organizer ? <Avatar uri={event.organizer.avatar_url} name={event.organizer.username} size={20} /> : null}
      <Text style={styles.going} numberOfLines={1}>
        {going} going{event.organizer ? ` · by ${event.organizer.username}` : ''}
      </Text>
      {joined ? (
        <View style={styles.joinedChip}>
          <Icon name="checkmark" size={12} color={Colors.success} />
          <Text style={styles.joinedText}>Joined</Text>
        </View>
      ) : status ? (
        <Text style={[styles.status, left === 0 && styles.statusFull]}>{status}</Text>
      ) : null}
    </View>
  );

  const label = `${event.title}, ${when}${where ? `, ${where}` : ''}, ${going} going${joined ? ', you joined' : ''}`;

  if (variant === 'card') {
    return (
      <TouchableOpacity style={styles.card} onPress={open} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}>
        <View>
          {cover}
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{when}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          {where ? (
            <Text style={styles.where} numberOfLines={1}>
              {where}
            </Text>
          ) : null}
          {footer}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={open} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}>
      {cover}
      <View style={styles.rowBody}>
        <Text style={styles.when}>{when}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        {where ? (
          <Text style={styles.where} numberOfLines={1}>
            {where}
          </Text>
        ) : null}
        {footer}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      width: 260,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    cardCover: {
      width: '100%',
      height: 118,
      backgroundColor: Colors.borderLight,
    },
    coverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePill: {
      position: 'absolute',
      left: 10,
      top: 10,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    datePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cardBody: {
      padding: 12,
      gap: 3,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      padding: 10,
      marginHorizontal: 16,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    rowCover: {
      width: 76,
      height: 76,
      borderRadius: 10,
      backgroundColor: Colors.borderLight,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    when: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    where: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    going: {
      flex: 1,
      fontSize: 12,
      color: Colors.textSecondary,
    },
    joinedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: Colors.success + '1F',
    },
    joinedText: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.success,
    },
    status: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.warning,
    },
    statusFull: {
      color: Colors.textLight,
    },
  });
