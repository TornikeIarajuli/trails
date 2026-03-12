import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../../../../constants/colors';
import { useEvent, useJoinEvent, useLeaveEvent, useDeleteEvent } from '../../../../../hooks/useEvents';
import { useComments, useAddComment, useDeleteComment } from '../../../../../hooks/useComments';
import { useAuthStore } from '../../../../../store/authStore';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { Button } from '../../../../../components/ui/Button';
import { Avatar } from '../../../../../components/ui/Avatar';
import { ActivityComment } from '../../../../../types/comment';

function getRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();

  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: event, isLoading } = useEvent(eventId);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const deleteEvent = useDeleteEvent();

  // Comments — inline, no modal
  const { data: comments = [], isLoading: commentsLoading } = useComments(eventId);
  const addComment = useAddComment();
  const deleteCommentMutation = useDeleteComment();
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    addComment.mutate(
      { activity_id: eventId, activity_type: 'event', comment: trimmed },
      { onSuccess: () => setCommentText('') },
    );
  };

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

  const headerData = [{ type: 'header' as const }];

  const renderHeader = () => (
    <>
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
        {isOrganizer && (
          <Button
            title="Cancel Event"
            onPress={handleDelete}
            variant="outline"
          />
        )}
      </View>

      {/* Comments section header */}
      <View style={styles.commentsHeader}>
        <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.commentsTitle}>
          Comments {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
      </View>

      {commentsLoading && (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
      )}

      {!commentsLoading && comments.length === 0 && (
        <Text style={styles.emptyComments}>No comments yet. Start the conversation!</Text>
      )}
    </>
  );

  const renderComment = ({ item }: { item: ActivityComment }) => {
    const isOwn = item.user_id === userId;
    return (
      <View style={styles.commentRow}>
        <Avatar uri={item.profiles?.avatar_url} name={item.profiles?.username} size={34} />
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername}>{item.profiles?.username ?? 'User'}</Text>
            <Text style={styles.commentTime}>{getRelativeTime(item.created_at)}</Text>
          </View>
          <Text style={styles.commentText}>{item.comment}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity
            style={styles.deleteCommentBtn}
            onPress={() => deleteCommentMutation.mutate({ id: item.id, activity_id: eventId })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete comment"
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
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
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Sticky input at bottom */}
        {isAuthenticated && (
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textLight}
              value={commentText}
              onChangeText={setCommentText}
              maxLength={500}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!commentText.trim() || addComment.isPending) && styles.sendButtonDisabled]}
              onPress={handleSendComment}
              disabled={!commentText.trim() || addComment.isPending}
              accessibilityLabel="Send comment"
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { paddingBottom: 8 },
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
    actions: { marginHorizontal: 16, gap: 10, marginBottom: 8 },
    // Comments section
    commentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    commentsTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
    emptyComments: {
      textAlign: 'center',
      color: Colors.textLight,
      fontSize: 14,
      paddingVertical: 24,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    commentBubble: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 10,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    commentUsername: { fontSize: 13, fontWeight: '700', color: Colors.text },
    commentTime: { fontSize: 11, color: Colors.textLight },
    commentText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
    deleteCommentBtn: { paddingTop: 10 },
    // Input bar
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
      backgroundColor: Colors.background,
    },
    input: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      fontSize: 14,
      color: Colors.text,
      maxHeight: 80,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.4 },
  });
