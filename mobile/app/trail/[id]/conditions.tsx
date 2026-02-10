import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrailConditions } from '../../../hooks/useCommunity';
import { useAuthStore } from '../../../store/authStore';
import { ReportConditionModal } from '../../../components/community/ReportConditionModal';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailCondition } from '../../../types/community';
import { formatDate } from '../../../utils/formatters';

const SEVERITY_COLORS: Record<string, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  danger: '#F44336',
};

const CONDITION_ICONS: Record<string, string> = {
  trail_clear: 'checkmark-circle',
  muddy: 'water',
  snow: 'snow',
  fallen_tree: 'leaf',
  flooded: 'rainy',
  overgrown: 'flower',
  damaged: 'construct',
  closed: 'close-circle',
};

const CONDITION_LABELS: Record<string, string> = {
  trail_clear: 'Trail Clear',
  muddy: 'Muddy',
  snow: 'Snow',
  fallen_tree: 'Fallen Tree',
  flooded: 'Flooded',
  overgrown: 'Overgrown',
  damaged: 'Damaged',
  closed: 'Closed',
};

export default function ConditionsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: conditions, isLoading } = useTrailConditions(id);
  const [modalVisible, setModalVisible] = useState(false);

  const renderCondition = ({ item }: { item: TrailCondition }) => {
    const color = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.info;
    const icon = CONDITION_ICONS[item.condition_type] ?? 'alert-circle';
    const label = CONDITION_LABELS[item.condition_type] ?? item.condition_type;

    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardHeader}>
          <View style={styles.typeRow}>
            <Ionicons name={icon as any} size={20} color={color} />
            <Text style={[styles.typeLabel, { color }]}>{label}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.severityText, { color }]}>
              {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}

        <View style={styles.footer}>
          <View style={styles.userRow}>
            <Avatar
              uri={item.profiles?.avatar_url}
              name={item.profiles?.username}
              size={20}
            />
            <Text style={styles.username}>{item.profiles?.username}</Text>
          </View>
          <Text style={styles.date}>{formatDate(item.reported_at)}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Trail Conditions</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={conditions ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderCondition}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>No conditions reported</Text>
            <Text style={styles.emptySubtext}>Trail appears to be in good shape!</Text>
          </View>
        }
      />

      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="flag" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <ReportConditionModal
        trailId={id}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  date: {
    fontSize: 12,
    color: Colors.textLight,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textLight,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
