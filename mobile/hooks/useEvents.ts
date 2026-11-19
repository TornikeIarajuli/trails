import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService, TripMessage } from '../services/events';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';
import { showError } from '../utils/showError';

export function useTrailEvents(trailId: string) {
  return useQuery({
    queryKey: queryKeys.events.trail(trailId),
    queryFn: () => eventsService.getTrailEvents(trailId),
    enabled: !!trailId,
  });
}

/** Upcoming group hikes on every trail (Explore and the Group hikes screen). */
export function useUpcomingEvents() {
  return useQuery({
    queryKey: queryKeys.events.upcoming(),
    queryFn: () => eventsService.getUpcomingEvents(),
    staleTime: 5 * 60 * 1000,
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

/** Your trips and group hikes (private ones too), until their last day. */
export function useMyEvents() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.events.mine(),
    queryFn: () => eventsService.getMyEvents(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
}

/** How often an open chat checks for new messages. */
export const CHAT_REFRESH_MS = 5000;

/** The trip's chat (newest first), checked every few seconds while it is open. */
export function useTripMessages(eventId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.events.messages(eventId),
    queryFn: () => eventsService.getMessages(eventId),
    enabled: !!eventId && enabled,
    refetchInterval: CHAT_REFRESH_MS,
    staleTime: 0,
  });
}

/** Sends a message: shown at once (as sending), replaced by the server's copy. */
export function useSendMessage(eventId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const key = queryKeys.events.messages(eventId);
  return useMutation({
    mutationFn: (body: string) => eventsService.sendMessage(eventId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const temp: TripMessage = {
        id: `pending-${Date.now()}`,
        event_id: eventId,
        user_id: user?.id ?? '',
        body,
        created_at: new Date().toISOString(),
        profiles: { username: user?.user_metadata?.username ?? 'You', avatar_url: null },
        pending: true,
      };
      queryClient.setQueryData<TripMessage[]>(key, (old) => [temp, ...(old ?? [])]);
      return { tempId: temp.id };
    },
    onSuccess: (message, _body, context) => {
      queryClient.setQueryData<TripMessage[]>(key, (old) =>
        (old ?? []).map((m) => (m.id === context?.tempId ? message : m)),
      );
    },
    onError: (err, _body, context) => {
      queryClient.setQueryData<TripMessage[]>(key, (old) => (old ?? []).filter((m) => m.id !== context?.tempId));
      showError(err);
    },
  });
}

export function useDeleteMessage(eventId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.events.messages(eventId);
  return useMutation({
    mutationFn: (messageId: string) => eventsService.deleteMessage(eventId, messageId),
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<TripMessage[]>(key, (old) => (old ?? []).filter((m) => m.id !== messageId));
    },
    onError: (err) => showError(err),
  });
}
