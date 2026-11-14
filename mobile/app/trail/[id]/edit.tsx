import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../components/ui/Icon';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { trailsService, UpdateTrailData } from '../../../services/trails';
import {
  mediaService,
  describeImageUpload,
  getUploadErrorMessage,
} from '../../../services/media';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { TrailDifficulty, TrailMedia } from '../../../types/trail';
import { queryKeys } from '../../../utils/queryKeys';
import { getErrorMessage } from '../../../utils/showError';
import { buildTrailUpdate, trailToForm, TrailEditForm } from '../../../utils/trailEditForm';

const DIFFICULTIES: TrailDifficulty[] = ['easy', 'medium', 'hard', 'ultra'];

const EMPTY_FORM: TrailEditForm = {
  nameEn: '',
  nameKa: '',
  descEn: '',
  descKa: '',
  difficulty: 'medium',
  region: '',
  distanceKm: '',
  elevationGainM: '',
  estimatedHours: '',
  coverImageUrl: '',
};

function DifficultyPicker({
  value,
  onChange,
}: {
  value: TrailDifficulty;
  onChange: (d: TrailDifficulty) => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Difficulty</Text>
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.difficultyChip, d === value && styles.difficultyChipActive]}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: d === value }}
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
  onAdd,
  isUploading,
}: {
  media: TrailMedia[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  isUploading: boolean;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Trail Photos ({media.length})</Text>
      <View style={styles.mediaGrid}>
        {media.map((m) => (
          <View key={m.id} style={styles.mediaItem}>
            <Image source={{ uri: m.url }} style={styles.mediaImage} cachePolicy="memory-disk" transition={150} />
            <TouchableOpacity
              style={styles.mediaDeleteBtn}
              onPress={() => {
                Alert.alert('Delete Photo', 'Remove this photo from the trail?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(m.id) },
                ]);
              }}
              hitSlop={6}
              accessibilityLabel="Delete photo"
              accessibilityRole="button"
            >
              <Icon name="close-circle" size={22} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addPhotoBtn}
          onPress={onAdd}
          disabled={isUploading}
          accessibilityLabel={isUploading ? 'Uploading photo' : 'Add photo'}
          accessibilityRole="button"
          accessibilityState={{ busy: isUploading, disabled: isUploading }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Icon name="add-circle-outline" size={28} color={Colors.primary} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TrailEditScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: trail, isLoading, isError, error, isFetching, refetch, isRefetching } = useTrail(id);

  const [form, setForm] = useState<TrailEditForm>(EMPTY_FORM);
  const [initialised, setInitialised] = useState(false);
  const [localMedia, setLocalMedia] = useState<TrailMedia[]>([]);
  const [photosChanged, setPhotosChanged] = useState(false);

  const setField = <K extends keyof TrailEditForm>(key: K, value: TrailEditForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Fill the form once, from up-to-date data. Later refetches (after a photo upload,
  // on reconnect, when the app returns to the foreground…) must not wipe what was typed.
  useEffect(() => {
    if (!trail || initialised || isFetching) return;
    setForm(trailToForm(trail));
    setLocalMedia(trail.media ?? []);
    setInitialised(true);
  }, [trail, initialised, isFetching]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTrailData) => trailsService.updateTrail(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trailLists() });
      Alert.alert('Saved', 'Trail updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      Alert.alert('Error', getErrorMessage(err, 'Failed to update trail'));
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => trailsService.deleteTrailMedia(mediaId),
    onSuccess: (_data, mediaId) => {
      setLocalMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setPhotosChanged(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(id) });
    },
    onError: (err) => {
      Alert.alert('Error', getErrorMessage(err, 'Failed to delete photo'));
    },
  });

  // Trail gallery photos go to the admin endpoint (`trail_media`), not to the
  // community photo endpoint — that one files them under "Community Photos".
  const uploadMediaMutation = useMutation({
    mutationFn: (asset: ImagePicker.ImagePickerAsset) => {
      const { fileName, mimeType } = describeImageUpload(asset);
      return mediaService.uploadTrailMedia(id, asset.uri, fileName, mimeType);
    },
    onSuccess: (media) => {
      if (media?.id) {
        setLocalMedia((prev) => (prev.some((m) => m.id === media.id) ? prev : [...prev, media]));
      }
      setPhotosChanged(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(id) });
    },
    onError: (err) => {
      Alert.alert('Upload failed', getUploadErrorMessage(err));
    },
  });

  const pickPhoto = async () => {
    if (uploadMediaMutation.isPending) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadMediaMutation.mutate(result.assets[0]);
    }
  };

  const handleSave = () => {
    if (!trail) return;
    const result = buildTrailUpdate(trail, form);
    if (!result.ok) {
      Alert.alert('Check the form', result.error);
      return;
    }

    if (Object.keys(result.data).length === 0) {
      if (photosChanged) {
        Alert.alert('Saved', 'Photo changes saved successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No Changes', 'Nothing to update.');
      }
      return;
    }

    updateMutation.mutate(result.data);
  };

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Edit Trail',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (!trail) {
    return (
      <>
        {header}
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <ErrorState
            error={error}
            title="Couldn't load this trail"
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        )}
      </>
    );
  }

  if (!initialised) {
    return (
      <>
        {header}
        <LoadingSpinner />
      </>
    );
  }

  return (
    <>
      {header}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {isError && (
          <ErrorState
            compact
            error={error}
            message="Couldn't refresh this trail — you are editing the last saved copy."
            onRetry={() => refetch()}
            retrying={isRefetching}
            style={styles.staleNotice}
          />
        )}

        <Input
          label="Name (English)"
          value={form.nameEn}
          onChangeText={(v) => setField('nameEn', v)}
          error={form.nameEn.trim() ? undefined : 'Required'}
        />
        <Input label="Name (Georgian)" value={form.nameKa} onChangeText={(v) => setField('nameKa', v)} />

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description (English)</Text>
          <Input
            value={form.descEn}
            onChangeText={(v) => setField('descEn', v)}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Description (Georgian)</Text>
          <Input
            value={form.descKa}
            onChangeText={(v) => setField('descKa', v)}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
          />
        </View>

        <DifficultyPicker value={form.difficulty} onChange={(d) => setField('difficulty', d)} />

        <Input
          label="Region"
          value={form.region}
          onChangeText={(v) => setField('region', v)}
          error={form.region.trim() ? undefined : 'Required'}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Input
              label="Distance (km)"
              value={form.distanceKm}
              onChangeText={(v) => setField('distanceKm', v)}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="Elevation (m)"
              value={form.elevationGainM}
              onChangeText={(v) => setField('elevationGainM', v)}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="Hours"
              value={form.estimatedHours}
              onChangeText={(v) => setField('estimatedHours', v)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Input
          label="Cover Image URL"
          value={form.coverImageUrl}
          onChangeText={(v) => setField('coverImageUrl', v)}
          autoCapitalize="none"
          keyboardType="url"
        />

        {form.coverImageUrl.trim() ? (
          <Image source={{ uri: form.coverImageUrl.trim() }} style={styles.coverPreview} cachePolicy="memory-disk" transition={180} />
        ) : null}

        <MediaGrid
          media={localMedia}
          onDelete={(mid) => deleteMediaMutation.mutate(mid)}
          onAdd={pickPhoto}
          isUploading={uploadMediaMutation.isPending}
        />

        <View style={styles.infoBox}>
          <Icon name="lock-closed-outline" size={16} color={Colors.textLight} />
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

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  staleNotice: {
    marginBottom: 16,
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
  addPhotoBtn: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 4,
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
