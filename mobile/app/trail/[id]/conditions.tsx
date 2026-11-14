import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrailConditions } from '../../../hooks/useCommunity';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { useAuthStore } from '../../../store/authStore';
import { ReportConditionModal } from '../../../components/community/ReportConditionModal';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ContentMenu } from '../../../components/moderation/ContentMenu';
import { TrailCondition } from '../../../types/community';
import { formatDate } from '../../../utils/formatters';
import { sortConditionsBySeverity } from '../../../utils/conditions';
import { withBottomInset } from '../../../utils/insets';

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
  const { data, isLoading, isError, error, refetch, isRefetching } = useTrailConditions(id);
  const visible = useWithoutBlocked(data, (condition) => condition.user_id);
  // Most severe first, so a recent "trail clear" never pushes an active "closed" out of sight
  const conditions = useMemo(() => sortConditionsBySeverity(visible), [visible]);
  const [modalVisible, setModalVisible] = useState(false);

  const renderCondition = ({ item }: { item: TrailCondition }) => {
    const color = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.info;
    const icon = CONDITION_ICONS[item.condition_type] ?? 'alert-circle';
    const label = CONDITION_LABELS[item.condition_type] ?? item.condition_type;

    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardHeader}>
          <View style={styles.typeRow}>
            <Icon name={icon as any} size={20} color={color} />
            <Text style={[styles.typeLabel, { color }]}>{label}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <View style={[styles.severityBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.severityText, { color }]}>
                {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
              </Text>
            </View>
            <ContentMenu
              targetType="condition"
              targetId={item.id}
              targetLabel="report"
              authorId={item.user_id}
              authorName={item.profiles?.username}
              iconSize={16}
            />
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

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingSpinner />;
  } else if (isError && conditions.length === 0) {
    // Never fall through to the empty state here: "no reports" would read as "safe"
    body = (
      <ErrorState
        error={error}
        title="Couldn't load trail conditions"
        message="Recent reports for this trail could not be loaded, so conditions are unknown. Check your connection and try again."
        onRetry={() => refetch()}
        retrying={isRefetching}
      />
    );
  } else {
    body = (
      <FlatList
        data={conditions}
        keyExtractor={(item) => item.id}
        renderItem={renderCondition}
        contentContainerStyle={withBottomInset(styles.list, insets.bottom)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          conditions.length > 0 ? (
            <Text style={styles.listHint}>Reports from the last 14 days, most serious first.</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="chatbox-ellipses-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No recent reports</Text>
            <Text style={styles.emptySubtext}>
              Nobody has reported conditions on this trail in the last 14 days. Check the weather
              and local advice before you set off.
            </Text>
            {isAuthenticated && (
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => setModalVisible(true)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyActionText}>Report what you saw</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Trail Conditions</Text>
        <View style={{ width: 24 }} />
      </View>

      {body}

      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Report a trail condition"
          accessibilityRole="button"
        >
          <Icon name="flag" size={24} color="#fff" />
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
    flexGrow: 1,
  },
  listHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textLight,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
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
