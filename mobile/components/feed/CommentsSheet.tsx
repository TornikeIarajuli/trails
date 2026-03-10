import React, { useMemo, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../constants/colors';
import { useComments, useAddComment, useDeleteComment } from '../../hooks/useComments';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
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
  const insets = useSafeAreaInsets();

  const currentUserId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { data: comments = [], isLoading } = useComments(activityId);
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
    deleteComment.mutate({ id: comment.id, activity_id: activityId });
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
        {isOwn && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete comment"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}
        >
          {/* Handle + header */}
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close comments" accessibilityRole="button">
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              }
            />
          )}

          {/* Input row */}
          {currentUserId && (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Add a comment…"
                placeholderTextColor={Colors.textLight}
                value={text}
                onChangeText={setText}
                maxLength={500}
                multiline
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
                  <Ionicons name="send" size={18} color={Colors.textOnPrimary} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingHorizontal: 16,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: Colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    loadingContainer: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
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
      backgroundColor: Colors.surface,
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
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
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
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
