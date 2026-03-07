import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../../../../constants/colors';
import { useEvent, useJoinEvent, useLeaveEvent, useDeleteEvent } from '../../../../../hooks/useEvents';
import { useAuthStore } from '../../../../../store/authStore';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { Button } from '../../../../../components/ui/Button';
import { CommentsSheet } from '../../../../../components/feed/CommentsSheet';

export default function EventDetailScreen() {
  const { id: trailId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const insets = useSafeAreaInsets();
  const [showComments, setShowComments] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: event, isLoading } = useEvent(eventId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const deleteEvent = useDeleteEvent();

  if (isLoading || !event) return <LoadingSpinner />;

  const isOrganizer = event.organizer_id === userId;
  const isParticipant = event.participants?.some((p) => p.user_id === userId);
  const isFull =
    event.max_participants != null &&
    (event.participants?.length ?? 0) >= event.max_participants;

  const scheduledDate = new Date(event.scheduled_at);

  const handleDelete = () => {
    Alert.alert('Delete Event', 'This will cancel the group hike for all participants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteEvent.mutate(eventId, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: event.title,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          // @ts-ignore - headerStatusBarHeight not in Expo Router types but works at runtime
          headerStatusBarHeight: insets.top,
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.dateCard}>
          <Text style={styles.dateText}>
            {scheduledDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={styles.timeText}>
            {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Trail</Text>
          <Text style={styles.value}>{event.trails?.name_en}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Organizer</Text>
          <Text style={styles.value}>@{event.organizer?.username}</Text>
        </View>

        {event.description ? (
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>
            Participants ({event.participants?.length ?? 0}
            {event.max_participants ? `/${event.max_participants}` : ''})
          </Text>
          {(event.participants ?? []).map((p) => (
            <TouchableOpacity
              key={p.user_id}
              style={styles.participantRow}
              onPress={() => router.push(`/trail/user/${p.user_id}` as any)}
              activeOpacity={0.7}
            >
              {p.profiles.avatar_url ? (
                <Image
                  source={{ uri: p.profiles.avatar_url }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={14} color={Colors.textLight} />
                </View>
              )}
              <Text style={styles.participantName}>@{p.profiles.username}</Text>
              {p.user_id === event.organizer_id && (
                <Text style={styles.organizerTag}>Organizer</Text>
              )}
              <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actions}>
          {isAuthenticated && !isOrganizer && (
            isParticipant ? (
              <Button
                title="Leave"
                onPress={() => leaveEvent.mutate(eventId)}
                loading={leaveEvent.isPending}
                variant="outline"
              />
            ) : (
              <Button
                title={isFull ? 'Event Full' : 'Join Hike'}
                onPress={() => joinEvent.mutate(eventId)}
                loading={joinEvent.isPending}
                disabled={isFull}
              />
            )
          )}
          <TouchableOpacity style={styles.commentsBtn} onPress={() => setShowComments(true)}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            <Text style={styles.commentsBtnText}>Comments</Text>
          </TouchableOpacity>
          {isOrganizer && (
            <Button
              title="Cancel Event"
              onPress={handleDelete}
              variant="outline"
            />
          )}
        </View>
      </ScrollView>

      <CommentsSheet
        activityId={eventId}
        activityType="event"
        visible={showComments}
        onClose={() => setShowComments(false)}
      />
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    dateCard: {
      margin: 16,
      padding: 20,
      backgroundColor: Colors.primary,
      borderRadius: 14,
      alignItems: 'center',
    },
    dateText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    timeText: { fontSize: 14, color: '#fff', opacity: 0.85, marginTop: 4 },
    section: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 14,
      backgroundColor: Colors.surface,
      borderRadius: 10,
      gap: 6,
    },
    label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    value: { fontSize: 16, color: Colors.text, fontWeight: '500' },
    description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    avatar: { width: 28, height: 28, borderRadius: 14 },
    avatarFallback: { backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
    participantName: { fontSize: 14, color: Colors.text, flex: 1 },
    organizerTag: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
    actions: { margin: 16, gap: 10 },
    commentsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.primary + '40',
      backgroundColor: Colors.primary + '10',
    },
    commentsBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  });
