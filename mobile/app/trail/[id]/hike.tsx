import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useTrail } from '../../../hooks/useTrails';
import { useHikeStore } from '../../../store/hikeStore';
import { useLocationTracking } from '../../../hooks/useLocation';
import { Config } from '../../../constants/config';
import { parseGeoPoint, parseGeoLineString, haversineDistance } from '../../../utils/geo';
import { mediaService, describeImageUpload } from '../../../services/media';
import { useRecordHike } from '../../../hooks/useCompletions';
import { stopBackgroundTracking } from '../../../utils/locationTask';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../../store/authStore';
import { usersService } from '../../../services/users';
import { completionsService } from '../../../services/completions';
import { analytics } from '../../../utils/analytics';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { discardActiveHike } from '../../../utils/hikeSession';
import { buildSmsUrl, buildSosSmsBody } from '../../../utils/links';
import { getErrorMessage } from '../../../utils/showError';
import { classifySyncFailure } from '../../../utils/syncQueue';
import { MAX_FIX_ACCURACY_M, buildPendingCompletion, isWithinCheckinRange } from '../../../utils/track';
import { recordKeptPastMark } from '../../../utils/pastHikes';
import { RecordHikeResponse } from '../../../types/completion';
import { useMapStyle } from '../../../hooks/useMapStyle';
import { TopoTileLayer, topoMapType } from '../../../components/map/TopoTileLayer';
import { MapStyleToggle } from '../../../components/map/MapStyleToggle';
import { TopoAttribution } from '../../../components/map/TopoAttribution';

// Isolated timer component — only this re-renders every second
function HikeTimer({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const isActive = useHikeStore((s) => s.isActive);
  const isPaused = useHikeStore((s) => s.isPaused);
  const tick = useHikeStore((s) => s.tick);
  const elapsedSeconds = useHikeStore((s) => s.elapsedSeconds);
  const Colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive) return;
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

  // Pulse animation when paused
  useEffect(() => {
    if (isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPaused]);

  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return (
    <View style={[styles.timerContainer, isPaused && styles.timerContainerPaused]}>
      <Ionicons name={isPaused ? 'pause-circle-outline' : 'time-outline'} size={18} color={isPaused ? Colors.warning : Colors.primary} />
      <Animated.Text style={[styles.timer, isPaused && styles.timerPaused, { opacity: pulseAnim }]}>
        {formatted}
      </Animated.Text>
    </View>
  );
}

function leaveScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/home');
}

function call112() {
  Linking.openURL('tel:112').catch(() => {
    Alert.alert('Could not start the call', 'Dial 112 from your phone app.');
  });
}

export default function HikeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [hikePhotos, setHikePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const mapRef = useRef<MapView>(null);
  const hasInitialLocation = useRef(false);
  // Offline the standard map cannot load, so the topo tiles kept on the phone take over
  const { topo, offline, toggle: toggleMapStyle } = useMapStyle({ autoTopoWhenOffline: true });

  const hydrated = useHikeStore((s) => s._hydrated);
  const isActive = useHikeStore((s) => s.isActive);
  const activeTrailId = useHikeStore((s) => s.trailId);
  const isPaused = useHikeStore((s) => s.isPaused);
  const visitedCheckpointIds = useHikeStore((s) => s.visitedCheckpointIds);
  const distanceCoveredMeters = useHikeStore((s) => s.distanceCoveredMeters);
  const startHike = useHikeStore((s) => s.startHike);
  const endHike = useHikeStore((s) => s.endHike);
  const pauseHike = useHikeStore((s) => s.pauseHike);
  const resumeHike = useHikeStore((s) => s.resumeHike);
  const addGpsPoint = useHikeStore((s) => s.addGpsPoint);
  const markCheckpointVisited = useHikeStore((s) => s.markCheckpointVisited);
  const enqueueCompletion = useHikeStore((s) => s.enqueueCompletion);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // The stored trail id says which hike is running; the route only says which
  // trail's hike screen was opened. They differ when a hike on another trail is
  // still active, and nothing may then be recorded under this route's trail.
  const isThisHike = hydrated && isActive && activeTrailId === id;
  const otherTrailId = hydrated && isActive && activeTrailId && activeTrailId !== id ? activeTrailId : null;

  const { data: trail } = useTrail(id);
  const { data: otherTrail } = useTrail(otherTrailId ?? '');

  // Haptic tracking refs
  const nearbyAlertedRef = useRef<Set<string>>(new Set());
  const milestonesFiredRef = useRef<Set<number>>(new Set());

  const {
    location,
    status: locationStatus,
    canAskAgain,
    backgroundTracking,
    retry: retryLocation,
  } = useLocationTracking(isThisHike && !saving);
  const recordHike = useRecordHike();

  // Parse route from trail data
  const routeCoords = trail?.route ? parseGeoLineString(trail.route) : [];
  const parsedCheckpoints = (trail?.checkpoints ?? [])
    .map((cp) => {
      const coord = parseGeoPoint(cp.coordinates);
      return coord ? { ...cp, coord } : null;
    })
    .filter(Boolean) as any[];

  const beginHike = () => {
    if (!id) return;
    startHike(id, useAuthStore.getState().user?.id ?? null);
    analytics.hikeStarted(id, trail?.name_en ?? id);
  };

  // Start a hike on mount unless one is already running (on this trail or another)
  useEffect(() => {
    if (!hydrated || !id || finishedRef.current) return;
    if (!useHikeStore.getState().isActive) beginHike();
  }, [hydrated, id]);

  // Show this hiker in the trail's "currently hiking" count while the screen is open
  useEffect(() => {
    if (!isThisHike || !id) return;
    completionsService.markActive(id).catch(() => {});
    return () => {
      completionsService.clearActive(id).catch(() => {});
    };
  }, [isThisHike, id]);

  // Track GPS points, center map on first fix, and detect nearby checkpoints
  useEffect(() => {
    if (!location || !isThisHike) return;

    addGpsPoint(location.latitude, location.longitude, {
      timestamp: location.timestamp,
      accuracy: location.accuracy,
    });
    if (!hasInitialLocation.current) {
      hasInitialLocation.current = true;
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }

    // Checkpoint proximity haptics
    parsedCheckpoints.forEach((cp) => {
      if (useHikeStore.getState().visitedCheckpointIds.includes(cp.id)) return;
      const dist = haversineDistance(location.latitude, location.longitude, cp.coord.latitude, cp.coord.longitude);

      if (dist < 150 && !nearbyAlertedRef.current.has(cp.id)) {
        nearbyAlertedRef.current.add(cp.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (isWithinCheckinRange(dist, location.accuracy)) {
        markCheckpointVisited(cp.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [location]);

  // Milestone haptics at 25 / 50 / 75 / 100% of trail distance
  useEffect(() => {
    if (!isThisHike || !trail?.distance_km) return;
    const totalMeters = trail.distance_km * 1000;
    const pct = (distanceCoveredMeters / totalMeters) * 100;
    for (const threshold of [25, 50, 75, 100]) {
      if (pct >= threshold && !milestonesFiredRef.current.has(threshold)) {
        milestonesFiredRef.current.add(threshold);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [distanceCoveredMeters]);

  const currentPosition = (): { lat: number; lng: number } | null => {
    if (location) return { lat: location.latitude, lng: location.longitude };
    const points = useHikeStore.getState().gpsPoints;
    const last = points[points.length - 1];
    return last ? { lat: last.lat, lng: last.lng } : null;
  };

  // Shown whenever the emergency contact was not (confirmed to be) reached
  const offerSosFallback = (title: string, message: string) => {
    Alert.alert(title, `${message}\n\nCall 112, or text your location to someone who can help.`, [
      { text: 'Call 112', onPress: call112 },
      {
        text: 'Text my location',
        onPress: () => {
          Linking.openURL(buildSmsUrl(buildSosSmsBody(currentPosition()), Platform.OS)).catch(() => {
            Alert.alert('Could not open messages', 'Send a text message from your messaging app.');
          });
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  const alertEmergencyContact = async () => {
    const position = currentPosition();
    if (!position) {
      offerSosFallback('No GPS position yet', 'Your emergency contact was not alerted because your position is not known yet.');
      return;
    }
    try {
      const result = await usersService.sendSos(position.lat, position.lng);
      if (result?.sent === true) {
        Alert.alert('Alert sent', 'Your emergency contact has been notified with your location.', [
          { text: 'Call 112', onPress: call112 },
          { text: 'OK', style: 'cancel' },
        ]);
      } else if (result?.reason === 'no_contact') {
        offerSosFallback('No emergency contact', 'You have not chosen an emergency contact, so nobody was alerted.');
      } else if (result?.reason === 'contact_unreachable') {
        offerSosFallback('Contact not reached', 'Your emergency contact has no device that can receive alerts right now, so nobody was alerted.');
      } else {
        offerSosFallback('Alert not confirmed', 'We could not confirm that your emergency contact was alerted.');
      }
    } catch {
      offerSosFallback('Alert not sent', 'The server could not be reached, so your emergency contact was not alerted.');
    }
  };

  const handleSos = () => {
    Alert.alert('SOS', 'How do you want to get help?', [
      { text: 'Alert my emergency contact', style: 'destructive', onPress: alertEmergencyContact },
      { text: 'Call 112', onPress: call112 },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const finishHike = async () => {
    const hike = useHikeStore.getState();
    if (savingRef.current || finishedRef.current || !hike.isActive || !hike.trailId) return;
    savingRef.current = true;
    setSaving(true);

    const trailId = hike.trailId;
    // Recorded for the account that started the hike, whoever is signed in by now
    const completion = buildPendingCompletion(
      { ...hike, trailId },
      hike.ownerId ?? useAuthStore.getState().user?.id ?? null,
    );

    // Only the upload itself is inside the try: an error in what follows a successful
    // upload must not be mistaken for a failed one and queue the hike a second time.
    let result: RecordHikeResponse;
    try {
      result = await recordHike.mutateAsync(completion);
    } catch (error) {
      if (classifySyncFailure(error) === 'drop') {
        // The server refused this hike; sending it again later would not help
        savingRef.current = false;
        setSaving(false);
        Alert.alert('This hike could not be recorded', getErrorMessage(error), [
          { text: 'Keep hike open', style: 'cancel' },
          {
            text: 'Discard hike',
            style: 'destructive',
            onPress: () => {
              finishedRef.current = true;
              discardActiveHike();
              leaveScreen();
            },
          },
        ]);
        return;
      }

      finishedRef.current = true;
      enqueueCompletion(completion);
      void stopBackgroundTracking();
      endHike({ localId: completion.localId });
      leaveScreen();
      Alert.alert(
        'Hike saved on your phone',
        'Your hike could not be uploaded right now, so it is stored on this phone. It will upload by itself once you are online and signed in — keep the app installed until then.',
      );
      return;
    }

    finishedRef.current = true;
    analytics.hikeCompleted(trailId, completion.elapsedSeconds, hike.distanceCoveredMeters / 1000);
    void stopBackgroundTracking();
    endHike({ completionId: result?.id ?? null });

    if (!result?.id) {
      leaveScreen();
      return;
    }
    // On a trail marked done by a past hike, a hike that did not verify comes back as
    // that past completion: saved for review, not a success and not "already completed"
    const keptPastMark = recordKeptPastMark(result);
    // A backend without track verification reports no `verified`: go by the status it stored
    const verified = result.verified ?? result.status !== 'pending';
    const params = [
      'fresh=1',
      keptPastMark ? 'review=1' : `verified=${verified ? '1' : '0'}`,
      result.verification?.reason ? `reason=${encodeURIComponent(result.verification.reason)}` : null,
      typeof result.verification?.coverage === 'number' ? `coverage=${result.verification.coverage}` : null,
      typeof result.verification?.required_coverage === 'number'
        ? `required=${result.verification.required_coverage}`
        : null,
      result.already_existed && !keptPastMark ? 'already=1' : null,
      result.new_badge_ids?.length
        ? `newBadgeIds=${encodeURIComponent(JSON.stringify(result.new_badge_ids))}`
        : null,
    ].filter(Boolean);
    router.replace(`/trail/completion/${result.id}?${params.join('&')}` as any);
  };

  const handleEndHike = () => {
    if (savingRef.current) return;
    Alert.alert('End Hike', 'Are you sure you want to end this hike?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Hike', style: 'destructive', onPress: finishHike },
    ]);
  };

  const confirmDiscardOther = () => {
    Alert.alert(
      'Discard the other hike?',
      'Its recorded route is deleted and it will not count as a completion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard and start',
          style: 'destructive',
          onPress: () => {
            discardActiveHike();
            beginHike();
          },
        },
      ],
    );
  };

  const openLocationSettings = () => {
    const open =
      Platform.OS === 'android' && locationStatus === 'disabled'
        ? Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
        : Linking.openSettings();
    open.catch(() => Linking.openSettings().catch(() => {}));
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!id) return;
    setHikePhotos((prev) => [asset.uri, ...prev]);

    setUploading(true);
    try {
      const { fileName, mimeType } = describeImageUpload(asset);
      await mediaService.uploadHikePhoto(id, asset.uri, fileName, mimeType);
    } catch {
      // Photo saved locally even if upload fails
    } finally {
      setUploading(false);
    }
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

    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0]);
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

    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0]);
  };

  const handlePhotoPress = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!hydrated) return <LoadingSpinner />;

  if (otherTrailId) {
    const otherName = otherTrail?.name_en ?? 'another trail';
    return (
      <View style={[styles.conflict, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Ionicons name="footsteps-outline" size={44} color={Colors.accent} />
        <Text style={styles.conflictTitle}>You already have a hike in progress</Text>
        <Text style={styles.conflictBody}>
          Your hike on {otherName} is still being recorded. Resume it, or discard it to start{' '}
          {trail?.name_en ?? 'this trail'} instead.
        </Text>
        <Button
          title={`Resume ${otherName}`}
          onPress={() => router.replace(`/trail/${otherTrailId}/hike` as any)}
          style={styles.conflictButton}
        />
        <Button
          title="Discard it and start this one"
          variant="outline"
          onPress={confirmDiscardOther}
          style={styles.conflictButton}
        />
        <TouchableOpacity onPress={leaveScreen} style={styles.conflictBack} accessibilityRole="button">
          <Text style={styles.conflictBackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const locationBlocked = locationStatus === 'denied' || locationStatus === 'disabled';
  const weakSignal =
    !!location && typeof location.accuracy === 'number' && location.accuracy > MAX_FIX_ACCURACY_M;
  let hint = 'Walk toward checkpoints to check in';
  if (saving) hint = 'Saving your hike — this can take up to a minute on a slow connection';
  else if (locationStatus === 'denied') hint = 'Location access is off, so your route is not being recorded.';
  else if (locationStatus === 'disabled') hint = 'Location is turned off on this phone, so your route is not being recorded.';
  else if (!location) hint = 'Acquiring GPS signal...';
  else if (weakSignal) hint = `Weak GPS signal (±${Math.round(location.accuracy ?? 0)} m) — waiting for a better fix`;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={Config.DEFAULT_MAP_REGION}
        showsUserLocation
        mapType={topoMapType(topo)}
      >
        {topo && <TopoTileLayer offline={offline} />}

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
                        <Image source={{ uri: item }} style={styles.calloutPhoto} cachePolicy="memory-disk" />
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
        <TouchableOpacity testID="close-button" style={styles.iconButton} onPress={handleEndHike} disabled={saving} accessibilityLabel="End hike" accessibilityRole="button">
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

      {/* Recording only continues while the app is open */}
      {locationStatus === 'ready' && backgroundTracking === 'unavailable' && (
        <View style={[styles.notice, { top: insets.top + 60 }]} pointerEvents="none">
          <Ionicons name="warning-outline" size={16} color={Colors.textOnPrimary} />
          <Text style={styles.noticeText}>Keep the app open — background tracking is unavailable</Text>
        </View>
      )}

      {/* SOS Button */}
      {isAuthenticated && (
        <TouchableOpacity
          style={[styles.sosButton, { bottom: 200 + insets.bottom }]}
          onPress={handleSos}
          accessibilityLabel="SOS emergency alert"
          accessibilityRole="button"
        >
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>
      )}

      {/* Map style, above the photo button. Offline there is nothing else to switch to. */}
      {offline ? (
        <View
          style={[styles.offlineMapBadge, { bottom: 268 + insets.bottom }]}
          accessibilityLabel="Offline: showing the topo map saved on this phone"
        >
          <Ionicons name="cloud-offline-outline" size={14} color="#263238" />
          <Text style={styles.offlineMapBadgeText}>Offline topo map</Text>
        </View>
      ) : (
        <MapStyleToggle
          topo={topo}
          onToggle={toggleMapStyle}
          style={[styles.mapStyleToggle, { bottom: 268 + insets.bottom }]}
        />
      )}

      {/* Photo button */}
      <TouchableOpacity
        style={[styles.photoButton, { bottom: 200 + insets.bottom }]}
        onPress={handlePhotoPress}
        disabled={uploading}
        accessibilityLabel={uploading ? 'Uploading photo' : 'Take photo'}
        accessibilityRole="button"
      >
        <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={26} color="#fff" />
      </TouchableOpacity>

      {/* Bottom info */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {/* The panel covers the bottom of the map, so the topo credit goes on top of it */}
        {topo && <TopoAttribution variant="inline" style={styles.topoCredit} />}
        <Text style={styles.trailName}>{trail?.name_en ?? 'Loading...'}</Text>
        <Text style={[styles.hint, locationBlocked && !saving && styles.hintWarning]}>{hint}</Text>

        {locationBlocked && !saving && (
          <TouchableOpacity
            style={styles.hintAction}
            onPress={locationStatus === 'denied' && canAskAgain ? retryLocation : openLocationSettings}
            accessibilityRole="button"
          >
            <Text style={styles.hintActionText}>
              {locationStatus === 'denied' && canAskAgain ? 'Allow location' : 'Open Settings'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Photo strip */}
        {hikePhotos.length > 0 && (
          <FlatList
            data={hikePhotos}
            horizontal
            keyExtractor={(_, i) => i.toString()}
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.photoThumb} cachePolicy="memory-disk" />
            )}
          />
        )}

        <View style={styles.hikeActions}>
          <TouchableOpacity
            style={[styles.pauseButton, isPaused && styles.pauseButtonResume, saving && styles.actionDisabled]}
            onPress={isPaused ? resumeHike : pauseHike}
            disabled={saving}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={18}
              color={isPaused ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.pauseButtonText, isPaused && styles.pauseButtonTextResume]}>
              {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.endButton, saving && styles.actionDisabled]}
            onPress={handleEndHike}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving && <ActivityIndicator size="small" color={Colors.error} />}
            <Text style={styles.endButtonText}>{saving ? 'Saving…' : 'End Hike'}</Text>
          </TouchableOpacity>
        </View>
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
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
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
  mapStyleToggle: {
    position: 'absolute',
    right: 16,
  },
  offlineMapBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  offlineMapBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263238',
  },
  topoCredit: {
    color: Colors.textSecondary,
    marginBottom: 6,
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
    textAlign: 'center',
  },
  hintWarning: {
    color: Colors.error,
    fontWeight: '600',
    marginBottom: 8,
  },
  hintAction: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  hintActionText: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
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
  timerContainerPaused: {
    backgroundColor: Colors.warning + '20',
  },
  timerPaused: {
    color: Colors.warning,
  },
  hikeActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pauseButtonResume: {
    backgroundColor: Colors.success + '20',
  },
  pauseButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  pauseButtonTextResume: {
    color: Colors.success,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error + '15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  endButtonText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  sosButton: {
    position: 'absolute',
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  sosText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  conflict: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  conflictTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  conflictBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  conflictButton: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  conflictBack: {
    paddingVertical: 10,
  },
  conflictBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});
