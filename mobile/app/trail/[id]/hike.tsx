import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { useHikeStore } from '../../../store/hikeStore';
import { useLocationTracking } from '../../../hooks/useLocation';
import { Config } from '../../../constants/config';
import { parseGeoPoint, parseGeoLineString } from '../../../utils/geo';
import { mediaService } from '../../../services/media';
import { useRecordHike } from '../../../hooks/useCompletions';

// Isolated timer component — only this re-renders every second
function HikeTimer({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const isActive = useHikeStore((s) => s.isActive);
  const tick = useHikeStore((s) => s.tick);
  const elapsedSeconds = useHikeStore((s) => s.elapsedSeconds);
  const Colors = useColors();

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return (
    <View style={styles.timerContainer}>
      <Ionicons name="time-outline" size={18} color={Colors.primary} />
      <Text style={styles.timer}>{formatted}</Text>
    </View>
  );
}

export default function HikeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: trail } = useTrail(id);
  const [hikePhotos, setHikePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const hasInitialLocation = useRef(false);

  const isActive = useHikeStore((s) => s.isActive);
  const visitedCheckpointIds = useHikeStore((s) => s.visitedCheckpointIds);
  const startHike = useHikeStore((s) => s.startHike);
  const endHike = useHikeStore((s) => s.endHike);
  const addGpsPoint = useHikeStore((s) => s.addGpsPoint);

  const location = useLocationTracking(isActive);
  const recordHike = useRecordHike();

  // Parse route from trail data
  const routeCoords = trail?.route ? parseGeoLineString(trail.route) : [];
  const parsedCheckpoints = (trail?.checkpoints ?? [])
    .map((cp) => {
      const coord = parseGeoPoint(cp.coordinates);
      return coord ? { ...cp, coord } : null;
    })
    .filter(Boolean) as any[];

  // Start hike on mount
  useEffect(() => {
    if (!isActive && id) {
      startHike(id);
    }
  }, [id]);

  // Track GPS points & center map on first fix
  useEffect(() => {
    if (location && isActive) {
      addGpsPoint(location.latitude, location.longitude);
      if (!hasInitialLocation.current) {
        hasInitialLocation.current = true;
        mapRef.current?.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    }
  }, [location]);

  const handleEndHike = () => {
    Alert.alert('End Hike', 'Are you sure you want to end this hike?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Hike',
        style: 'destructive',
        onPress: () => {
          const elapsed = useHikeStore.getState().elapsedSeconds;
          if (id) {
            recordHike.mutate(
              { trailId: id, elapsedSeconds: elapsed },
              {
                onSettled: () => {
                  endHike();
                  router.back();
                },
              },
            );
          } else {
            endHike();
            router.back();
          }
        },
      },
    ]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0] && id) {
      const asset = result.assets[0];
      setHikePhotos((prev) => [asset.uri, ...prev]);

      setUploading(true);
      try {
        const fileName = asset.uri.split('/').pop() || 'hike_photo.jpg';
        await mediaService.uploadHikePhoto(id, asset.uri, fileName, 'image/jpeg');
      } catch {
        // Photo saved locally even if upload fails
      } finally {
        setUploading(false);
      }
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0] && id) {
      const asset = result.assets[0];
      setHikePhotos((prev) => [asset.uri, ...prev]);

      setUploading(true);
      try {
        const fileName = asset.uri.split('/').pop() || 'hike_photo.jpg';
        await mediaService.uploadHikePhoto(id, asset.uri, fileName, 'image/jpeg');
      } catch {
        // Photo saved locally even if upload fails
      } finally {
        setUploading(false);
      }
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={Config.DEFAULT_MAP_REGION}
        showsUserLocation
      >
        {/* Trail route polyline */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.primary}
            strokeWidth={3}
          />
        )}

        {/* Checkpoint markers */}
        {parsedCheckpoints.map((cp) => {
          const visited = visitedCheckpointIds.includes(cp.id);
          const cpPhotos = cp.photos ?? [];
          return (
            <Marker
              key={cp.id}
              coordinate={cp.coord}
              pinColor={visited ? '#4CAF50' : Colors.accent}
            >
              <Callout tooltip style={styles.calloutContainer}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{cp.name_en}</Text>
                  <Text style={styles.calloutType}>{cp.type}</Text>
                  {cpPhotos.length > 0 ? (
                    <FlatList
                      data={cpPhotos}
                      horizontal
                      keyExtractor={(_, i) => i.toString()}
                      showsHorizontalScrollIndicator={false}
                      style={styles.calloutPhotoStrip}
                      renderItem={({ item }) => (
                        <Image source={{ uri: item }} style={styles.calloutPhoto} />
                      )}
                    />
                  ) : (
                    <View style={styles.noPhotosContainer}>
                      <Ionicons name="image-outline" size={20} color={Colors.textSecondary} />
                      <Text style={styles.noPhotosText}>No photos yet</Text>
                    </View>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={handleEndHike}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>

        <HikeTimer styles={styles} />

        <View style={styles.checkpointCount}>
          <Ionicons name="camera" size={16} color={Colors.textOnPrimary} style={{ marginRight: 4 }} />
          <Text style={styles.checkpointCountText}>
            {hikePhotos.length}/{parsedCheckpoints.length}
          </Text>
        </View>
      </View>

      {/* Photo button */}
      <TouchableOpacity
        style={[styles.photoButton, { bottom: 200 + insets.bottom }]}
        onPress={handlePhotoPress}
        disabled={uploading}
      >
        <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={26} color="#fff" />
      </TouchableOpacity>

      {/* Bottom info */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.trailName}>{trail?.name_en ?? 'Loading...'}</Text>
        <Text style={styles.hint}>
          {location
            ? 'Walk toward checkpoints to check in'
            : 'Acquiring GPS signal...'}
        </Text>

        {/* Photo strip */}
        {hikePhotos.length > 0 && (
          <FlatList
            data={hikePhotos}
            horizontal
            keyExtractor={(_, i) => i.toString()}
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.photoThumb} />
            )}
          />
        )}

        <TouchableOpacity style={styles.endButton} onPress={handleEndHike}>
          <Text style={styles.endButtonText}>End Hike</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface + 'E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface + 'E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  timer: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  checkpointCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + 'E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  checkpointCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  calloutContainer: {
    width: 200,
  },
  callout: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  calloutType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  calloutPhotoStrip: {
    marginTop: 4,
  },
  calloutPhoto: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 6,
  },
  noPhotosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  noPhotosText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  photoButton: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  trailName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  photoStrip: {
    marginBottom: 12,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 8,
  },
  endButton: {
    backgroundColor: Colors.error + '15',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  endButtonText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
});
