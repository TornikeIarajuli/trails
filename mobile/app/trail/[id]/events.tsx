import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../components/ui/Icon';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrailEvents, useCreateEvent, useDeleteEvent } from '../../../hooks/useEvents';
import { useWithoutBlocked } from '../../../hooks/useModeration';
import { useAuthStore } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { TrailEvent } from '../../../services/events';
import { ErrorState } from '../../../components/ui/ErrorState';
import { haptics } from '../../../utils/haptics';
import {
  validateEventForm,
  EVENT_DESCRIPTION_MAX,
  EVENT_TITLE_MAX,
} from '../../../utils/eventForm';
import { withBottomInset } from '../../../utils/insets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PickerMode = 'date' | 'time' | null;

function nextFullHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function EventCard({
  event,
  userId,
  onDelete,
  onPress,
  styles,
  Colors,
}: {
  event: TrailEvent;
  userId: string | undefined;
  onDelete: (id: string) => void;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ColorPalette;
}) {
  const isOrganizer = event.organizer_id === userId;
  const participantCount = event.participant_count?.[0]?.count ?? 0;
  const date = new Date(event.scheduled_at);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <View style={styles.cardDate}>
        <Text style={styles.dateDay}>{date.getDate()}</Text>
        <Text style={styles.dateMonth}>{date.toLocaleString('en', { month: 'short' })}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardOrganizer}>by {event.organizer?.username ?? 'Unknown'}</Text>
        <View style={styles.cardMeta}>
          <Icon name="time-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.cardMetaText}>
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Icon name="people-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.cardMetaText}>
            {participantCount}{event.max_participants ? `/${event.max_participants}` : ''} hikers
          </Text>
        </View>
      </View>
      {isOrganizer && (
        <TouchableOpacity
          onPress={() => onDelete(event.id)}
          style={styles.deleteBtn}
          hitSlop={8}
          accessibilityLabel={`Cancel group hike ${event.title}`}
          accessibilityRole="button"
        >
          <Icon name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function TrailEventsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);

  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const eventsQuery = useTrailEvents(id);
  const events = useWithoutBlocked(eventsQuery.data, (event) => event.organizer_id);
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(nextFullHour);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [maxParticipants, setMaxParticipants] = useState('');

  const applyPickedValue = (mode: 'date' | 'time', selected: Date) => {
    setScheduledAt((current) => {
      const next = new Date(current);
      if (mode === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    const mode = pickerMode;
    if (!mode) return;
    if (Platform.OS === 'android') {
      // Android shows a dialog that closes itself; unmount it on any outcome
      setPickerMode(null);
      if (event.type === 'set' && selected) applyPickedValue(mode, selected);
      return;
    }
    // iOS spinner: every scroll tick lands here — keep it open until "Done"
    if (selected) applyPickedValue(mode, selected);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMaxParticipants('');
    setPickerMode(null);
    setScheduledAt(nextFullHour());
  };

  const handleCreate = () => {
    const result = validateEventForm({ title, description, scheduledAt, maxParticipants });
    if (!result.ok) {
      Alert.alert(result.title, result.message);
      return;
    }
    // Failures are reported by the hook itself
    createEvent.mutate(
      { trail_id: id, ...result.data },
      { onSuccess: () => { haptics.success(); setShowForm(false); resetForm(); } },
    );
  };

  const handleDelete = (eventId: string) => {
    Alert.alert('Cancel group hike', 'This cancels the hike for everyone who joined.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel hike', style: 'destructive', onPress: () => deleteEvent.mutate(eventId) },
    ]);
  };

  const form = showForm ? (
    <View style={styles.form}>
      <Text style={styles.formTitle}>New Group Hike</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={Colors.textLight}
        value={title}
        onChangeText={setTitle}
        maxLength={EVENT_TITLE_MAX}
        accessibilityLabel="Title"
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Description (optional)"
        placeholderTextColor={Colors.textLight}
        value={description}
        onChangeText={setDescription}
        maxLength={EVENT_DESCRIPTION_MAX}
        multiline
        accessibilityLabel="Description"
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.pickerBtn, { flex: 1 }, pickerMode === 'date' && styles.pickerBtnActive]}
          onPress={() => setPickerMode(pickerMode === 'date' ? null : 'date')}
          accessibilityRole="button"
          accessibilityLabel="Choose date"
        >
          <Icon name="calendar-outline" size={16} color={Colors.primary} />
          <Text style={styles.pickerText}>
            {scheduledAt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pickerBtn, { flex: 1 }, pickerMode === 'time' && styles.pickerBtnActive]}
          onPress={() => setPickerMode(pickerMode === 'time' ? null : 'time')}
          accessibilityRole="button"
          accessibilityLabel="Choose time"
        >
          <Icon name="time-outline" size={16} color={Colors.primary} />
          <Text style={styles.pickerText}>
            {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
      </View>
      {pickerMode && (
        <View>
          <DateTimePicker
            value={scheduledAt}
            mode={pickerMode}
            display={
              Platform.OS === 'android' ? (pickerMode === 'date' ? 'calendar' : 'clock') : 'spinner'
            }
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            themeVariant={isDarkMode ? 'dark' : 'light'}
            onChange={onPickerChange}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.pickerDone}
              onPress={() => setPickerMode(null)}
              accessibilityRole="button"
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <TextInput
        style={styles.input}
        placeholder="Max participants, including you (optional)"
        placeholderTextColor={Colors.textLight}
        keyboardType="number-pad"
        value={maxParticipants}
        onChangeText={setMaxParticipants}
        maxLength={4}
        accessibilityLabel="Maximum participants"
      />
      <TouchableOpacity
        style={[styles.submitBtn, createEvent.isPending && styles.submitBtnBusy]}
        onPress={handleCreate}
        disabled={createEvent.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.submitText}>
          {createEvent.isPending ? 'Creating...' : 'Create Event'}
        </Text>
      </TouchableOpacity>
    </View>
  ) : null;

  let body: React.ReactNode;
  if (eventsQuery.isLoading) {
    body = <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />;
  } else if (eventsQuery.isError && events.length === 0 && !showForm) {
    body = (
      <ErrorState
        error={eventsQuery.error}
        title="Couldn't load group hikes"
        onRetry={() => eventsQuery.refetch()}
        retrying={eventsQuery.isRefetching}
      />
    );
  } else {
    body = (
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={withBottomInset(styles.listContent, insets.bottom)}
        keyboardShouldPersistTaps="handled"
        // An element, not a function: a new function each render would remount the form
        ListHeaderComponent={form}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isRefetching}
            onRefresh={() => eventsQuery.refetch()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          showForm ? null : (
            <View style={styles.empty}>
              <Icon name="calendar-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No upcoming group hikes</Text>
              {isAuthenticated && (
                <Text style={styles.emptyHint}>Tap + to organize one</Text>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            userId={userId}
            onDelete={handleDelete}
            onPress={() => router.push(`/trail/${id}/event/${item.id}` as any)}
            styles={styles}
            Colors={Colors}
          />
        )}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Group Hikes',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          headerRight: isAuthenticated
            ? () => (
                <TouchableOpacity
                  onPress={() => setShowForm(!showForm)}
                  style={{ marginRight: 16 }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showForm ? 'Close the new group hike form' : 'Organize a group hike'}
                >
                  <Icon name={showForm ? 'close' : 'add'} size={24} color={Colors.primary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {body}
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: 16, gap: 12, flexGrow: 1 },
    form: {
      padding: 16,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      gap: 10,
    },
    formTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
    input: {
      backgroundColor: Colors.card,
      borderRadius: 8,
      padding: 12,
      color: Colors.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    row: { flexDirection: 'row', gap: 8 },
    pickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Colors.card,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: Colors.primary + '40',
    },
    pickerBtnActive: {
      borderColor: Colors.primary,
    },
    pickerText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
    pickerDone: {
      alignSelf: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pickerDoneText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
    submitBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    submitBtnBusy: { opacity: 0.7 },
    submitText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 15 },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    cardDate: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: Colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateDay: { fontSize: 18, fontWeight: '800', color: Colors.primary, lineHeight: 20 },
    dateMonth: { fontSize: 10, fontWeight: '600', color: Colors.primary, textTransform: 'uppercase' },
    cardContent: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
    cardOrganizer: { fontSize: 12, color: Colors.textSecondary },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    cardMetaText: { fontSize: 12, color: Colors.textSecondary, marginRight: 6 },
    deleteBtn: { padding: 4 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
    emptyText: { fontSize: 16, color: Colors.textLight },
    emptyHint: { fontSize: 13, color: Colors.textLight },
  });
