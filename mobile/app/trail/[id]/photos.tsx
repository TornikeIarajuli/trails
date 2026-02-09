import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../constants/colors';
import { useTrailPhotos, useUploadPhoto, useTogglePhotoLike } from '../../../hooks/useCommunity';
import { useAuthStore } from '../../../store/authStore';
import { mediaService } from '../../../services/media';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailPhoto } from '../../../types/community';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 2;

export default function PhotoGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useTrailPhotos(id);
  const uploadPhotoMutation = useUploadPhoto();
  const toggleLikeMutation = useTogglePhotoLike();

  const photos = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'photo.jpg';
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const { url } = await mediaService.uploadHikePhoto(id, asset.uri, fileName, mimeType);
        uploadPhotoMutation.mutate({ trail_id: id, url });
      } catch {
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
  };

  const renderPhoto = ({ item }: { item: TrailPhoto }) => (
    <View style={styles.photoCard}>
      <Image source={{ uri: item.url }} style={styles.photo} />
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
          onPress={() => toggleLikeMutation.mutate(item.id)}
        >
          <Ionicons name="heart-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.likeCount}>{item.likes_count}</Text>
        </TouchableOpacity>
      </View>
      {item.caption && (
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>
      )}
    </View>
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Community Photos</Text>
        <View style={{ width: 24 }} />
      </View>

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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share!</Text>
          </View>
        }
      />

      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={handleAddPhoto}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: PHOTO_SIZE,
  },
  photoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
  caption: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 8,
    paddingBottom: 8,
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
});
