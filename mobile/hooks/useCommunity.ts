import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { communityService } from '../services/community';
import { ConditionType, SeverityLevel } from '../types/community';
import { showError } from '../utils/showError';
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

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      trail_id: string;
      url: string;
      caption?: string;
    }) => communityService.uploadPhoto(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.photos.trail(variables.trail_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.root() });
    },
    onError: (err) => showError(err),
  });
}

export function useTogglePhotoLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => communityService.toggleLike(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.photos.root() });
    },
    onError: (err) => showError(err),
  });
}
