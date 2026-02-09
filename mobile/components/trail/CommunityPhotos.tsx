import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useTrailPhotos } from '../../hooks/useCommunity';
import { useAuthStore } from '../../store/authStore';

interface CommunityPhotosProps {
  trailId: string;
  photosCount: number;
  onViewAll: () => void;
  onAddPhoto: () => void;
}

export function CommunityPhotos({
  trailId,
  photosCount,
  onViewAll,
  onAddPhoto,
}: CommunityPhotosProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useTrailPhotos(trailId);
  const photos = data?.pages.flatMap((p) => p.data) ?? [];

  if (photosCount === 0 && !isAuthenticated) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Community Photos{photosCount > 0 ? ` (${photosCount})` : ''}
        </Text>
        {photosCount > 4 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isAuthenticated && (
          <TouchableOpacity style={styles.addButton} onPress={onAddPhoto}>
            <Ionicons name="camera-outline" size={28} color={Colors.primary} />
            <Text style={styles.addText}>Add Photo</Text>
          </TouchableOpacity>
        )}

        {photos.slice(0, 6).map((photo) => (
          <TouchableOpacity key={photo.id} style={styles.photoCard} onPress={onViewAll}>
            <Image source={{ uri: photo.url }} style={styles.photo} />
            {photo.likes_count > 0 && (
              <View style={styles.likeBadge}>
                <Ionicons name="heart" size={10} color="#fff" />
                <Text style={styles.likeCount}>{photo.likes_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {photosCount === 0 && !isAuthenticated && (
          <Text style={styles.emptyText}>No photos yet</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  addButton: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  photoCard: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  likeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  likeCount: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    paddingLeft: 4,
  },
});
