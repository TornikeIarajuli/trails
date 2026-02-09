import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { trailsService, UpdateTrailData } from '../../../services/trails';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailDifficulty, TrailMedia } from '../../../types/trail';

const DIFFICULTIES: TrailDifficulty[] = ['easy', 'medium', 'hard', 'ultra'];

function DifficultyPicker({
  value,
  onChange,
}: {
  value: TrailDifficulty;
  onChange: (d: TrailDifficulty) => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Difficulty</Text>
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.difficultyChip, d === value && styles.difficultyChipActive]}
            onPress={() => onChange(d)}
          >
            <Text
              style={[
                styles.difficultyChipText,
                d === value && styles.difficultyChipTextActive,
              ]}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MediaGrid({
  media,
  onDelete,
}: {
  media: TrailMedia[];
  onDelete: (id: string) => void;
}) {
  if (media.length === 0) return null;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Trail Photos ({media.length})</Text>
      <View style={styles.mediaGrid}>
        {media.map((m) => (
          <View key={m.id} style={styles.mediaItem}>
            <Image source={{ uri: m.url }} style={styles.mediaImage} />
            <TouchableOpacity
              style={styles.mediaDeleteBtn}
              onPress={() => {
                Alert.alert('Delete Photo', 'Remove this photo from the trail?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(m.id) },
                ]);
              }}
            >
              <Ionicons name="close-circle" size={22} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TrailEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: trail, isLoading } = useTrail(id);

  const [nameEn, setNameEn] = useState('');
  const [nameKa, setNameKa] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descKa, setDescKa] = useState('');
  const [difficulty, setDifficulty] = useState<TrailDifficulty>('medium');
  const [region, setRegion] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationGainM, setElevationGainM] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [localMedia, setLocalMedia] = useState<TrailMedia[]>([]);

  useEffect(() => {
    if (trail) {
      setNameEn(trail.name_en || '');
      setNameKa(trail.name_ka || '');
      setDescEn(trail.description_en || '');
      setDescKa(trail.description_ka || '');
      setDifficulty(trail.difficulty);
      setRegion(trail.region || '');
      setDistanceKm(trail.distance_km?.toString() || '');
      setElevationGainM(trail.elevation_gain_m?.toString() || '');
      setEstimatedHours(trail.estimated_hours?.toString() || '');
      setCoverImageUrl(trail.cover_image_url || '');
      setLocalMedia(trail.media || []);
    }
  }, [trail]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTrailData) => trailsService.updateTrail(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trail', id] });
      queryClient.invalidateQueries({ queryKey: ['trails'] });
      Alert.alert('Saved', 'Trail updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to update trail');
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => trailsService.deleteTrailMedia(mediaId),
    onSuccess: (_data, mediaId) => {
      setLocalMedia((prev) => prev.filter((m) => m.id !== mediaId));
      queryClient.invalidateQueries({ queryKey: ['trail', id] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to delete photo');
    },
  });

  const handleSave = () => {
    const data: UpdateTrailData = {};

    if (nameEn !== trail?.name_en) data.name_en = nameEn;
    if (nameKa !== (trail?.name_ka || '')) data.name_ka = nameKa || undefined;
    if (descEn !== (trail?.description_en || '')) data.description_en = descEn || undefined;
    if (descKa !== (trail?.description_ka || '')) data.description_ka = descKa || undefined;
    if (difficulty !== trail?.difficulty) data.difficulty = difficulty;
    if (region !== (trail?.region || '')) data.region = region;
    if (distanceKm !== (trail?.distance_km?.toString() || ''))
      data.distance_km = distanceKm ? parseFloat(distanceKm) : undefined;
    if (elevationGainM !== (trail?.elevation_gain_m?.toString() || ''))
      data.elevation_gain_m = elevationGainM ? parseInt(elevationGainM, 10) : undefined;
    if (estimatedHours !== (trail?.estimated_hours?.toString() || ''))
      data.estimated_hours = estimatedHours ? parseFloat(estimatedHours) : undefined;
    if (coverImageUrl !== (trail?.cover_image_url || ''))
      data.cover_image_url = coverImageUrl || undefined;

    if (Object.keys(data).length === 0) {
      Alert.alert('No Changes', 'Nothing to update.');
      return;
    }

    updateMutation.mutate(data);
  };

  if (isLoading || !trail) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Edit Trail' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Input label="Name (English)" value={nameEn} onChangeText={setNameEn} />
        <Input label="Name (Georgian)" value={nameKa} onChangeText={setNameKa} />

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description (English)</Text>
          <Input
            value={descEn}
            onChangeText={setDescEn}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description (Georgian)</Text>
          <Input
            value={descKa}
            onChangeText={setDescKa}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
          />
        </View>

        <DifficultyPicker value={difficulty} onChange={setDifficulty} />

        <Input label="Region" value={region} onChangeText={setRegion} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Input
              label="Distance (km)"
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="Elevation (m)"
              value={elevationGainM}
              onChangeText={setElevationGainM}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="Hours"
              value={estimatedHours}
              onChangeText={setEstimatedHours}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Input
          label="Cover Image URL"
          value={coverImageUrl}
          onChangeText={setCoverImageUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} style={styles.coverPreview} />
        ) : null}

        <MediaGrid media={localMedia} onDelete={(mid) => deleteMediaMutation.mutate(mid)} />

        <View style={styles.infoBox}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.textLight} />
          <Text style={styles.infoText}>
            Route coordinates and GPS data cannot be edited from here.
          </Text>
        </View>

        <Button
          title={updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  difficultyChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  difficultyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  difficultyChipTextActive: {
    color: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowItem: {
    flex: 1,
  },
  coverPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: Colors.borderLight,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.borderLight,
  },
  mediaDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.surface,
    borderRadius: 11,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textLight,
    flex: 1,
  },
});
