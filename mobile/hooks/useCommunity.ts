import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  InfiniteData,
  QueryClient,
} from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { communityService } from '../services/community';
import {
  mediaService,
  describeImageUpload,
  getUploadErrorMessage,
  MAX_UPLOAD_BYTES,
} from '../services/media';
import { ConditionType, SeverityLevel, TrailPhoto } from '../types/community';
import { PaginatedResponse } from '../types/api';
import { showError } from '../utils/showError';
import { haptics } from '../utils/haptics';
import { queryKeys } from '../utils/queryKeys';

export function useTrailConditions(trailId: string) {
  return useQuery({
    queryKey: queryKeys.conditions.trail(trailId),
    queryFn: () => communityService.getTrailConditions(trailId),
    enabled: !!trailId,
  });
}

export function useReportCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      trail_id: string;
      condition_type: ConditionType;
      severity: SeverityLevel;
      description?: string;
      photo_url?: string;
    }) => communityService.reportCondition(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conditions.trail(variables.trail_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.root() });
    },
    onError: (err) => showError(err),
  });
}

export function useTrailPhotos(trailId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.photos.trail(trailId),
    queryFn: ({ pageParam = 1 }) =>
      communityService.getTrailPhotos(trailId, pageParam),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!trailId,
  });
}

/**
 * Picks a photo from the library and uploads it as a community photo of the trail.
 * The upload endpoint creates the `trail_photos` row itself, so nothing else is
 * posted afterwards — only the affected queries are refreshed.
 */
export function useAddTrailPhoto(trailId: string) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  // Also covers the time the system picker is open, when `isUploading` is still false
  const busy = useRef(false);

  const addPhoto = useCallback(async () => {
    if (busy.current || !trailId) return;
    busy.current = true;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
        Alert.alert('Photo too large', 'Please choose a photo smaller than 12 MB.');
        return;
      }

      setIsUploading(true);
      const { fileName, mimeType } = describeImageUpload(asset);
      await mediaService.uploadHikePhoto(trailId, asset.uri, fileName, mimeType);
      haptics.success();

      queryClient.invalidateQueries({ queryKey: queryKeys.photos.trail(trailId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(trailId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    } catch (err) {
      Alert.alert('Upload failed', getUploadErrorMessage(err));
    } finally {
      busy.current = false;
      setIsUploading(false);
    }
  }, [trailId, queryClient]);

  return { addPhoto, isUploading };
}

type PhotoPages = InfiniteData<PaginatedResponse<TrailPhoto>>;

function findPhoto(queryClient: QueryClient, trailId: string, photoId: string) {
  const cached = queryClient.getQueryData<PhotoPages>(queryKeys.photos.trail(trailId));
  for (const page of cached?.pages ?? []) {
    const photo = page.data.find((p) => p.id === photoId);
    if (photo) return photo;
  }
  return undefined;
}

function patchPhoto(
  queryClient: QueryClient,
  trailId: string,
  photoId: string,
  patch: (photo: TrailPhoto) => TrailPhoto,
) {
  queryClient.setQueryData<PhotoPages>(queryKeys.photos.trail(trailId), (old) =>
    old && {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.map((p) => (p.id === photoId ? patch(p) : p)),
      })),
    },
  );
}

const NO_KNOWN_LIKES: Record<string, boolean> = {};

/**
 * Which photos the signed-in user has liked, as learned from their own toggles.
 * The photo list endpoint does not always say (`is_liked` may be missing), and a
 * refetch would otherwise forget it. Lives in the query cache so it is dropped
 * with everything else on logout.
 */
export function useKnownPhotoLikes(): Record<string, boolean> {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.photoLikes(),
    queryFn: () =>
      queryClient.getQueryData<Record<string, boolean>>(queryKeys.photoLikes()) ?? NO_KNOWN_LIKES,
    initialData: NO_KNOWN_LIKES,
    staleTime: Infinity,
  });
  return data;
}

export function useTogglePhotoLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photo: { id: string; trailId: string }) => communityService.toggleLike(photo.id),
    onMutate: async ({ id, trailId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.photos.trail(trailId) });

      const before = findPhoto(queryClient, trailId, id);
      const knownLikes =
        queryClient.getQueryData<Record<string, boolean>>(queryKeys.photoLikes()) ?? NO_KNOWN_LIKES;
      const wasLiked = before?.is_liked ?? knownLikes[id] ?? false;

      patchPhoto(queryClient, trailId, id, (p) => ({
        ...p,
        is_liked: !wasLiked,
        likes_count: Math.max(0, (p.likes_count ?? 0) + (wasLiked ? -1 : 1)),
      }));

      return { before };
    },
    onError: (err, { id, trailId }, context) => {
      const before = context?.before;
      if (before) {
        patchPhoto(queryClient, trailId, id, (p) => ({
          ...p,
          is_liked: before.is_liked,
          likes_count: before.likes_count,
        }));
      }
      showError(err);
    },
    onSuccess: (result, { id, trailId }) => {
      if (typeof result?.liked !== 'boolean') return;
      patchPhoto(queryClient, trailId, id, (p) => ({
        ...p,
        is_liked: result.liked,
        likes_count: typeof result.likes_count === 'number' ? result.likes_count : p.likes_count,
      }));
      queryClient.setQueryData<Record<string, boolean>>(queryKeys.photoLikes(), (prev) => ({
        ...prev,
        [id]: result.liked,
      }));
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photo: { id: string; trailId: string }) => communityService.deletePhoto(photo.id),
    onSuccess: (_data, { trailId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.photos.trail(trailId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(trailId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
    onError: (err) => showError(err),
  });
}
