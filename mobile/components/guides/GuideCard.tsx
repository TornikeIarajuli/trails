import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { priceLabel } from '../../utils/guides';
import { haptics } from '../../utils/haptics';
import type { Guide } from '../../services/guides';

/** A guide in the list: who, what they offer, where, in which languages, for how much. */
export function GuideCard({ guide }: { guide: Guide }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const name = guide.profiles?.full_name || guide.profiles?.username || 'Guide';
  const price = priceLabel(guide);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        haptics.tap();
        router.push(`/trail/guides/${guide.user_id}` as never);
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${guide.headline}`}
      testID={`guide-card-${guide.user_id}`}
    >
      <Avatar uri={guide.profiles?.avatar_url ?? null} name={name} size={52} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Icon name="shield-checkmark" size={15} color={Colors.primary} accessibilityLabel="Verified guide" />
        </View>
        <Text style={styles.headline} numberOfLines={2}>
          {guide.headline}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[guide.regions.join(', '), guide.languages.join(', ')].filter(Boolean).join(' · ')}
        </Text>
        {price ? <Text style={styles.price}>{price}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={16} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginHorizontal: 16,
      borderRadius: 14,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    body: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    name: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    headline: {
      fontSize: 14,
      color: Colors.text,
    },
    meta: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    price: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.primary,
    },
  });
