import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../../../components/ui/Icon';
import { Avatar } from '../../../../../components/ui/Avatar';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../../../components/ui/ErrorState';
import { ContentMenu } from '../../../../../components/moderation/ContentMenu';
import { useColors, ColorPalette } from '../../../../../constants/colors';
import { useDeleteMessage, useEvent, useSendMessage, useTripMessages } from '../../../../../hooks/useEvents';
import { useWithoutBlocked } from '../../../../../hooks/useModeration';
import { useAuthStore } from '../../../../../store/authStore';
import { getErrorStatus } from '../../../../../utils/showError';
import { haptics } from '../../../../../utils/haptics';
import type { TripMessage } from '../../../../../services/events';
import { messageTime } from '../../../../../utils/trips';

const MAX_MESSAGE = 1000;

/**
 * A trip's chat, for the people going: newest at the bottom, checked every few seconds while
 * open (and a push for each new message when closed). Long-press your own message to delete
 * it; the ⋯ beside someone else's reports it or blocks them.
 */
export default function TripChatScreen() {
  const { eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: event } = useEvent(eventId);
  const messagesQuery = useTripMessages(eventId);
  const messages = useWithoutBlocked(messagesQuery.data, (m) => m.user_id);
  const send = useSendMessage(eventId);
  const remove = useDeleteMessage(eventId);
  const [text, setText] = useState('');
  const isOrganizer = !!event && event.organizer_id === userId;

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: event?.title ?? 'Group chat',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (messagesQuery.isLoading) {
    return (
      <>
        {header}
        <LoadingSpinner />
      </>
    );
  }

  if (messagesQuery.isError && !messagesQuery.data) {
    const status = getErrorStatus(messagesQuery.error);
    return (
      <>
        {header}
        <ErrorState
          error={messagesQuery.error}
          title={status === 403 ? 'Join the trip to see its chat' : status === 404 ? 'This trip is no longer available' : "Couldn't load the chat"}
          onRetry={status === 403 || status === 404 ? undefined : () => messagesQuery.refetch()}
          retrying={messagesQuery.isRefetching}
          showBack
        />
      </>
    );
  }

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    haptics.tap();
    setText('');
    send.mutate(body);
  };

  const confirmDelete = (message: TripMessage) => {
    if (message.pending) return;
    haptics.select();
    Alert.alert('Delete this message?', 'It is removed for everyone in the trip.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(message.id) },
    ]);
  };

  const renderItem = ({ item, index }: { item: TripMessage; index: number }) => {
    const mine = item.user_id === userId;
    // Messages are newest first: the one after this in the list was sent before it
    const previous = messages[index + 1];
    const showName = !mine && previous?.user_id !== item.user_id;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]} testID={mine ? 'chat-message-mine' : 'chat-message'}>
        {!mine ? (
          <View style={styles.avatarSlot}>
            {showName ? <Avatar uri={item.profiles?.avatar_url} name={item.profiles?.username} size={30} /> : null}
          </View>
        ) : null}
        <Pressable
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, item.pending && styles.pending]}
          onLongPress={mine || isOrganizer ? () => confirmDelete(item) : undefined}
          delayLongPress={350}
          accessibilityHint={mine || isOrganizer ? 'Long-press to delete' : undefined}
        >
          {showName ? <Text style={styles.name}>{item.profiles?.username ?? 'Hiker'}</Text> : null}
          <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
          <Text style={[styles.time, mine && styles.timeMine]}>{item.pending ? 'Sending…' : messageTime(item.created_at)}</Text>
        </Pressable>
        {!mine ? (
          <ContentMenu
            style={styles.menu}
            targetType="message"
            targetId={item.id}
            targetLabel="message"
            authorId={item.user_id}
            authorName={item.profiles?.username}
            iconSize={14}
          />
        ) : null}
      </View>
    );
  };

  return (
    <>
      {header}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chatbubbles-outline" size={40} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Say hello to the group</Text>
              <Text style={styles.emptyText}>
                Only the people going can read this chat: plan the meeting point, transport and gear here.
              </Text>
            </View>
          }
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message the group"
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={MAX_MESSAGE}
            accessibilityLabel="Message"
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.send, !text.trim() && styles.sendDisabled]}
            onPress={submit}
            disabled={!text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            testID="chat-send"
          >
            <Icon name="send" size={18} color={Colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      marginVertical: 2,
    },
    rowMine: {
      justifyContent: 'flex-end',
    },
    rowTheirs: {
      justifyContent: 'flex-start',
    },
    avatarSlot: {
      width: 30,
    },
    bubble: {
      maxWidth: '76%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      gap: 2,
    },
    bubbleMine: {
      backgroundColor: Colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: Colors.surface,
      borderBottomLeftRadius: 4,
    },
    pending: {
      opacity: 0.6,
    },
    name: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.primary,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      color: Colors.text,
    },
    bodyMine: {
      color: Colors.textOnPrimary,
    },
    time: {
      alignSelf: 'flex-end',
      fontSize: 10,
      color: Colors.textLight,
    },
    timeMine: {
      color: Colors.textOnPrimary,
      opacity: 0.8,
    },
    menu: {
      paddingBottom: 6,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 32,
      // The list is inverted: turn the empty state back the right way up
      transform: [{ scaleY: -1 }],
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 19,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      backgroundColor: Colors.background,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 42,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: Colors.text,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    send: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
    },
    sendDisabled: {
      opacity: 0.4,
    },
  });
