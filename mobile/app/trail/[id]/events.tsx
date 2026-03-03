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
} from 'react-native';
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

  const { data: events = [], isLoading } = useTrailEvents(id);
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

  const handleCreate = () => {
    if (!title.trim() || !date.trim() || !time.trim()) {
      Alert.alert('Required', 'Please fill in title, date, and time.');
      return;
    }
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    createEvent.mutate(
      {
        trail_id: id,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at,
        max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setTitle(''); setDescription(''); setDate(''); setTime(''); setMaxParticipants('');
        },
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
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={Colors.textLight}
                value={date}
                onChangeText={setDate}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Time (HH:MM)"
                placeholderTextColor={Colors.textLight}
                value={time}
                onChangeText={setTime}
              />
            </View>
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
