import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useComments, useAddComment, useDeleteComment } from '../../hooks/useComments';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ErrorState } from '../ui/ErrorState';
import { ContentMenu } from '../moderation/ContentMenu';
import { Sheet, SheetTextInput } from '../ui/Sheet';
import { ActivityComment } from '../../types/comment';

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

interface CommentsSheetProps {
  activityId: string;
  activityType: string;
  visible: boolean;
  onClose: () => void;
}

export function CommentsSheet({ activityId, activityType, visible, onClose }: CommentsSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Nothing is requested until the sheet is actually opened
  const { data: allComments, isLoading, isError, error, refetch, isRefetching } =
    useComments(activityId, 1, 50, visible);
  const comments = useWithoutBlocked(allComments, (comment) => comment.user_id);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment.mutate(
      { activity_id: activityId, activity_type: activityType, comment: trimmed },
      { onSuccess: () => setText('') },
    );
  };

  const handleDelete = (comment: ActivityComment) => {
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteComment.mutate({ id: comment.id, activity_id: activityId }),
      },
    ]);
  };

  const renderComment = ({ item }: { item: ActivityComment }) => {
    const isOwn = item.user_id === currentUserId;
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
        {isOwn ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete comment"
            accessibilityRole="button"
          >
            <Icon name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        ) : (
          <ContentMenu
            style={styles.deleteButton}
            targetType="comment"
            targetId={item.id}
            targetLabel="comment"
            authorId={item.user_id}
            authorName={item.profiles?.username}
            iconSize={16}
          />
        )}
      </View>
    );
  };

  const inputRow = currentUserId ? (
    <View style={styles.inputRow}>
      <SheetTextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Add a comment…"
        placeholderTextColor={Colors.textLight}
        value={text}
        onChangeText={setText}
        maxLength={500}
        multiline
        accessibilityLabel="Add a comment"
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || addComment.isPending) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || addComment.isPending}
        accessibilityLabel="Send comment"
        accessibilityRole="button"
      >
        {addComment.isPending ? (
          <ActivityIndicator size="small" color={Colors.textOnPrimary} />
        ) : (
          <Icon name="send" size={18} color={Colors.textOnPrimary} />
        )}
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Comments"
      closeLabel="Close comments"
      scrollable={false}
      footer={inputRow}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : isError && comments.length === 0 ? (
        <ErrorState
          compact
          error={error}
          message="Couldn't load the comments."
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={styles.loadError}
        />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
          }
        />
      )}
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    loadingContainer: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadError: {
      marginVertical: 24,
    },
    listContent: {
      paddingBottom: 12,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: Colors.textLight,
      fontSize: 14,
      paddingVertical: 40,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 12,
    },
    commentBubble: {
      flex: 1,
      backgroundColor: Colors.background,
      borderRadius: 12,
      padding: 10,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    commentUsername: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
    },
    commentTime: {
      fontSize: 11,
      color: Colors.textLight,
    },
    commentText: {
      fontSize: 14,
      color: Colors.text,
      lineHeight: 20,
    },
    deleteButton: {
      paddingTop: 10,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: Colors.background,
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
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
