import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { useColors, ColorPalette } from '../../constants/colors';
import { useComments, useAddComment, useDeleteComment } from '../../hooks/useComments';
import { useWithoutBlocked } from '../../hooks/useModeration';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ErrorState } from '../ui/ErrorState';
import { ContentMenu } from '../moderation/ContentMenu';
import { Sheet, SheetTextInput, useSheet } from '../ui/Sheet';
import { ActivityComment } from '../../types/comment';
import { shortTimeAgo } from '../../utils/notificationGroups';

interface CommentsSheetProps {
  activityId: string;
  activityType: string;
  visible: boolean;
  onClose: () => void;
}

type Styles = ReturnType<typeof createStyles>;

/** One comment. Rendered inside the sheet, so opening the author's profile can close it first. */
function CommentRow({
  comment,
  isOwn,
  onDelete,
  styles,
  Colors,
}: {
  comment: ActivityComment;
  isOwn: boolean;
  onDelete: (comment: ActivityComment) => void;
  styles: Styles;
  Colors: ColorPalette;
}) {
  const { dismiss } = useSheet();
  const username = comment.profiles?.username ?? 'Hiker';
  const openAuthor = () => dismiss(() => router.push(`/trail/user/${comment.user_id}`));

  return (
    <View style={styles.commentRow}>
      <Pressable
        onPress={openAuthor}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${username}'s profile`}
      >
        <Avatar uri={comment.profiles?.avatar_url} name={comment.profiles?.username} size={34} />
      </Pressable>
      <View style={styles.commentBody}>
        <Text style={styles.commentText}>
          <Text style={styles.commentUsername} onPress={openAuthor} suppressHighlighting>
            {username}
          </Text>
          {` ${comment.comment}`}
        </Text>
        <Text style={styles.commentTime}>{shortTimeAgo(comment.created_at)}</Text>
      </View>
      {isOwn ? (
        <TouchableOpacity
          style={styles.rowAction}
          onPress={() => onDelete(comment)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Delete comment"
          accessibilityRole="button"
        >
          <Icon name="trash-outline" size={17} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <ContentMenu
          style={styles.rowAction}
          targetType="comment"
          targetId={comment.id}
          targetLabel="comment"
          authorId={comment.user_id}
          authorName={comment.profiles?.username}
          iconSize={17}
        />
      )}
    </View>
  );
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

  const canSend = !!text.trim() && !addComment.isPending;
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
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        accessibilityLabel="Send comment"
        accessibilityRole="button"
      >
        {addComment.isPending ? (
          <ActivityIndicator size="small" color={Colors.textOnPrimary} />
        ) : (
          <Icon name="send" size={20} color={Colors.textOnPrimary} />
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
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              isOwn={item.user_id === currentUserId}
              onDelete={handleDelete}
              styles={styles}
              Colors={Colors}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chatbubble-outline" size={36} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptyText}>Start the conversation.</Text>
            </View>
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
    empty: {
      alignItems: 'center',
      paddingVertical: 36,
      gap: 6,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 16,
    },
    commentBody: {
      flex: 1,
      gap: 3,
    },
    commentUsername: {
      fontWeight: '700',
      color: Colors.text,
    },
    commentText: {
      fontSize: 14,
      color: Colors.text,
      lineHeight: 20,
    },
    commentTime: {
      fontSize: 12,
      color: Colors.textLight,
    },
    rowAction: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: Colors.background,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      fontSize: 15,
      color: Colors.text,
      maxHeight: 96,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
