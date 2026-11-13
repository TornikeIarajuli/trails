import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import {
  useTrailPhotos,
  useAddTrailPhoto,
  useTogglePhotoLike,
  useDeletePhoto,
  useKnownPhotoLikes,
} from '../../../hooks/useCommunity';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { useAuthStore } from '../../../store/authStore';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ContentMenu } from '../../../components/moderation/ContentMenu';
import { TrailPhoto } from '../../../types/community';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 2;

export default function PhotoGalleryScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTrailPhotos(id);
  const { addPhoto, isUploading } = useAddTrailPhoto(id);
  const toggleLikeMutation = useTogglePhotoLike();
  const deletePhotoMutation = useDeletePhoto();
  const knownLikes = useKnownPhotoLikes();

  const loadedPhotos = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((p) => p.data) ?? []).filter((photo) => {
      if (seen.has(photo.id)) return false;
      seen.add(photo.id);
      return true;
    });
  }, [data]);
  const photos = useWithoutBlocked(loadedPhotos, (photo) => photo.user_id);

  const handleToggleLike = (photo: TrailPhoto) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    toggleLikeMutation.mutate({ id: photo.id, trailId: id });
  };

  const handleDelete = (photo: TrailPhoto) => {
    Alert.alert('Delete photo', 'Remove this photo from the trail?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deletePhotoMutation.mutate({ id: photo.id, trailId: id }),
      },
    ]);
  };

  const renderPhoto = ({ item }: { item: TrailPhoto }) => {
    const liked = item.is_liked ?? knownLikes[item.id] ?? false;
    const isOwn = !!userId && item.user_id === userId;
    const likePending =
      toggleLikeMutation.isPending && toggleLikeMutation.variables?.id === item.id;

    return (
      <View style={styles.photoCard}>
        <Image source={{ uri: item.url }} style={styles.photo} cachePolicy="memory-disk" transition={180} />
        <View style={styles.photoFooter}>
          <View style={styles.userRow}>
            <Avatar
              uri={item.profiles?.avatar_url}
              name={item.profiles?.username}
              size={20}
            />
            <Text style={styles.username} numberOfLines={1}>
              {item.profiles?.username}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleToggleLike(item)}
            disabled={likePending}
            hitSlop={8}
            accessibilityLabel={`${liked ? 'Unlike' : 'Like'} photo, ${item.likes_count} likes`}
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={16}
              color={liked ? '#E53935' : Colors.textSecondary}
            />
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
              {item.likes_count}
            </Text>
          </TouchableOpacity>
          {isOwn ? (
            <TouchableOpacity
              style={styles.cardAction}
              onPress={() => handleDelete(item)}
              disabled={deletePhotoMutation.isPending}
              hitSlop={8}
              accessibilityLabel="Delete photo"
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          ) : (
            <ContentMenu
              style={styles.cardAction}
              targetType="photo"
              targetId={item.id}
              targetLabel="photo"
              authorId={item.user_id}
              authorName={item.profiles?.username}
              iconSize={16}
            />
          )}
        </View>
        {item.caption && (
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>
        )}
      </View>
    );
  };

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
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Community Photos</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : isError && photos.length === 0 ? (
        <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} color={Colors.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No photos yet</Text>
              <Text style={styles.emptySubtext}>
                {isAuthenticated ? 'Be the first to share one!' : 'Log in to share the first one.'}
              </Text>
            </View>
          }
        />
      )}

      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }, isUploading && styles.fabBusy]}
          onPress={addPhoto}
          disabled={isUploading}
          accessibilityLabel={isUploading ? 'Uploading photo' : 'Add photo'}
          accessibilityRole="button"
          accessibilityState={{ busy: isUploading, disabled: isUploading }}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="camera" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      )}
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
  row: {
    gap: 16,
    marginBottom: 16,
  },
  photoCard: {
    width: PHOTO_SIZE,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: PHOTO_SIZE,
    backgroundColor: Colors.borderLight,
  },
  photoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  likeCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  likeCountActive: {
    color: '#E53935',
  },
  cardAction: {
    paddingLeft: 2,
  },
  caption: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  footerSpinner: {
    paddingVertical: 16,
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabBusy: {
    opacity: 0.8,
  },
});
