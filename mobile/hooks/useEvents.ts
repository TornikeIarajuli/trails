import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService } from '../services/events';
import { queryKeys } from '../utils/queryKeys';
import { showError } from '../utils/showError';

export function useTrailEvents(trailId: string) {
  return useQuery({
    queryKey: queryKeys.events.trail(trailId),
    queryFn: () => eventsService.getTrailEvents(trailId),
    enabled: !!trailId,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => eventsService.getEvent(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: eventsService.createEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events.root() }),
    onError: (err) => showError(err),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsService.deleteEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events.root() }),
    onError: (err) => showError(err),
  });
}

export function useJoinEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsService.joinEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events.root() }),
    onError: (err) => showError(err),
  });
}

export function useLeaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsService.leaveEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events.root() }),
    onError: (err) => showError(err),
  });
}
