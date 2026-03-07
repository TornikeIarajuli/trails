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
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrailEvents, useCreateEvent, useDeleteEvent } from '../../../hooks/useEvents';
import { useAuthStore } from '../../../store/authStore';
import { TrailEvent } from '../../../services/events';

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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardDate}>
        <Text style={styles.dateDay}>{date.getDate()}</Text>
        <Text style={styles.dateMonth}>{date.toLocaleString('en', { month: 'short' })}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardOrganizer}>by {event.organizer?.username ?? 'Unknown'}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.cardMetaText}>
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.cardMetaText}>
            {participantCount}{event.max_participants ? `/${event.max_participants}` : ''} hikers
          </Text>
        </View>
      </View>
      {isOrganizer && (
        <TouchableOpacity onPress={() => onDelete(event.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function TrailEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: events = [], isLoading, refetch, isRefetching } = useTrailEvents(id);
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');

  const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      const next = new Date(scheduledAt);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setScheduledAt(next);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      const next = new Date(scheduledAt);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setScheduledAt(next);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setMaxParticipants('');
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
    setScheduledAt(d);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }
    if (scheduledAt <= new Date()) {
      Alert.alert('Invalid date', 'Please choose a future date and time.');
      return;
    }
    createEvent.mutate(
      {
        trail_id: id,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduledAt.toISOString(),
        max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
      },
      {
        onSuccess: () => { setShowForm(false); resetForm(); },
        onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Could not create event.'),
      },
    );
  };

  const handleDelete = (eventId: string) => {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEvent.mutate(eventId) },
    ]);
  };

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
                <TouchableOpacity onPress={() => setShowForm(!showForm)} style={{ marginRight: 16 }}>
                  <Ionicons name={showForm ? 'close' : 'add'} size={24} color={Colors.primary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <View style={styles.container}>
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Group Hike</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={Colors.textLight}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.textLight}
              value={description}
              onChangeText={setDescription}
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <Text style={styles.pickerText}>
                  {scheduledAt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1 }]} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.pickerText}>
                  {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="date"
                display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="time"
                display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                onChange={onTimeChange}
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Max participants (optional)"
              placeholderTextColor={Colors.textLight}
              keyboardType="number-pad"
              value={maxParticipants}
              onChangeText={setMaxParticipants}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={createEvent.isPending}
            >
              <Text style={styles.submitText}>
                {createEvent.isPending ? 'Creating...' : 'Create Event'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No upcoming group hikes</Text>
            {isAuthenticated && (
              <Text style={styles.emptyHint}>Tap + to organize one</Text>
            )}
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
        )}
      </View>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    form: {
      margin: 16,
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
    pickerText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
    submitBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyText: { fontSize: 16, color: Colors.textLight },
    emptyHint: { fontSize: 13, color: Colors.textLight },
  });
