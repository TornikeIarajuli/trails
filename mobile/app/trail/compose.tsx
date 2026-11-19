import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/ui/Icon';
import { ActionSheet } from '../../components/ui/ActionSheet';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { TrailPickerSheet, PickedTrail } from '../../components/trail/TrailPickerSheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { findCachedFeedItem, useFeedPost } from '../../hooks/useFeed';
import { useCreatePost, useUpdatePost } from '../../hooks/usePosts';
import { MAX_UPLOAD_BYTES, describeImageUpload, getUploadErrorMessage, mediaService } from '../../services/media';
import { MAX_PLACE_LENGTH, MAX_POST_LENGTH, MAX_POST_PHOTOS } from '../../services/posts';
import { withBottomInset } from '../../utils/insets';
import { haptics } from '../../utils/haptics';
import type { FeedItem } from '../../types/feed';

/** A photo of the post: on the phone until uploaded (`url` set once it is). */
interface DraftPhoto {
  uri: string;
  url: string | null;
  fileName: string;
  mimeType: string;
}

/** Show the character count once the text gets this close to the limit. */
const COUNT_FROM = MAX_POST_LENGTH - 200;

function photosOf(item: FeedItem): DraftPhoto[] {
  const urls = item.photo_urls?.length ? item.photo_urls : item.photo_url ? [item.photo_url] : [];
  return urls.map((url) => ({ uri: url, url, fileName: 'photo.jpg', mimeType: 'image/jpeg' }));
}

/**
 * Write a post (Feed > New post, or "Post about this trail"), or edit your own (`postId`):
 * text, up to six photos, optionally a trail and a place. Photos upload when it is posted.
 */
export default function ComposeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ postId?: string; trailId?: string; trailName?: string }>();
  const postId = typeof params.postId === 'string' && params.postId ? params.postId : undefined;

  // Editing: the post as cached (feed, saved, its screen), or loaded
  const cached = postId ? findCachedFeedItem(queryClient, postId) : undefined;
  const loaded = useFeedPost(postId && !cached ? postId : undefined);
  const original = cached ?? loaded.data;

  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [trail, setTrail] = useState<{ id: string; name: string } | null>(
    params.trailId ? { id: params.trailId, name: params.trailName ?? 'This trail' } : null,
  );
  const [place, setPlace] = useState('');
  const [pickingTrail, setPickingTrail] = useState(false);
  const [choosingSource, setChoosingSource] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const filledFrom = useRef<string | null>(null);
  const finished = useRef(false);

  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const sending = progress !== null;

  // Fill the form once with the post being edited
  useEffect(() => {
    if (!postId || !original || filledFrom.current === postId) return;
    filledFrom.current = postId;
    setBody(original.extra_text ?? '');
    setPhotos(photosOf(original));
    setTrail(original.trail_id ? { id: original.trail_id, name: original.trail_name_en ?? 'Trail' } : null);
    setPlace(original.place_name ?? '');
  }, [postId, original]);

  const dirty = postId
    ? !!original &&
      (body !== (original.extra_text ?? '') ||
        place !== (original.place_name ?? '') ||
        (trail?.id ?? null) !== original.trail_id ||
        photos.map((p) => p.uri).join() !== photosOf(original).map((p) => p.uri).join())
    : body.trim().length > 0 || photos.length > 0 || place.trim().length > 0;

  // Leaving with something written asks first; posting leaves without asking
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!dirty || finished.current) return;
      e.preventDefault();
      Alert.alert(postId ? 'Discard your changes?' : 'Discard this post?', undefined, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, postId]);

  const room = MAX_POST_PHOTOS - photos.length;

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const fitting = assets.filter((a) => !a.fileSize || a.fileSize <= MAX_UPLOAD_BYTES);
    if (fitting.length < assets.length) {
      Alert.alert('Photo too large', 'Photos over 12 MB were left out.');
    }
    const added = fitting.slice(0, room).map((a) => ({ uri: a.uri, url: null, ...describeImageUpload(a) }));
    if (added.length) {
      haptics.tap();
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_POST_PHOTOS));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!result.canceled) addAssets(result.assets);
  };

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const removePhoto = (uri: string) => {
    haptics.tap();
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const submit = async () => {
    if (sending) return;
    const text = body.trim();
    if (!text && photos.length === 0) {
      Alert.alert('Write something or add a photo');
      return;
    }
    try {
      // Upload what is still on the phone, keeping each URL so a retry does not upload again
      const urls: string[] = [];
      const toUpload = photos.filter((p) => !p.url).length;
      let uploaded = 0;
      for (const photo of photos) {
        if (photo.url) {
          urls.push(photo.url);
          continue;
        }
        uploaded += 1;
        setProgress(toUpload > 1 ? `Uploading photo ${uploaded} of ${toUpload}…` : 'Uploading photo…');
        const { url } = await mediaService.uploadPostPhoto(photo.uri, photo.fileName, photo.mimeType);
        urls.push(url);
        setPhotos((prev) => prev.map((p) => (p.uri === photo.uri ? { ...p, url } : p)));
      }

      setProgress(postId ? 'Saving…' : 'Posting…');
      const input = {
        body: text,
        trail_id: trail?.id ?? null,
        place_name: place.trim() || null,
        photo_urls: urls,
      };
      if (postId) await updatePost.mutateAsync({ postId, input });
      else await createPost.mutateAsync(input);

      haptics.success();
      finished.current = true;
      router.back();
    } catch (err) {
      Alert.alert(postId ? "Couldn't save your post" : "Couldn't post", getUploadErrorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: postId ? 'Edit post' : 'New post',
        headerRight: () => (
          <TouchableOpacity
            onPress={submit}
            disabled={sending}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={postId ? 'Save post' : 'Post'}
            testID="compose-submit"
          >
            {sending ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.submit}>{postId ? 'Save' : 'Post'}</Text>
            )}
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (postId && !original) {
    return (
      <>
        {header}
        {loaded.isError ? (
          <ErrorState error={loaded.error} title="Couldn't load your post" onRetry={() => loaded.refetch()} retrying={loaded.isRefetching} />
        ) : (
          <LoadingSpinner />
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <ScrollView
        style={styles.container}
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.body}
          value={body}
          onChangeText={setBody}
          placeholder="A trip report, a tip, a question for other hikers…"
          placeholderTextColor={Colors.textLight}
          multiline
          maxLength={MAX_POST_LENGTH}
          autoFocus={!postId}
          textAlignVertical="top"
          editable={!sending}
          accessibilityLabel="Post text"
          testID="compose-body"
        />
        {body.length >= COUNT_FROM ? (
          <Text style={styles.count}>
            {body.length.toLocaleString('en-US')} / {MAX_POST_LENGTH.toLocaleString('en-US')}
          </Text>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((photo, i) => (
            <View key={photo.uri} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
              {!sending ? (
                <TouchableOpacity
                  style={styles.remove}
                  onPress={() => removePhoto(photo.uri)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  testID={`compose-remove-photo-${i}`}
                >
                  <Icon name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {room > 0 && !sending ? (
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={() => setChoosingSource(true)}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              testID="compose-add-photo"
            >
              <Icon name="camera-outline" size={24} color={Colors.primary} />
              <Text style={styles.addPhotoText}>{photos.length ? `${room} more` : 'Add photos'}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <View style={styles.row}>
          <Icon name="trail-sign-outline" size={20} color={Colors.primary} />
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => setPickingTrail(true)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={trail ? `Trail: ${trail.name}. Change` : 'Add a trail'}
            testID="compose-trail"
          >
            <Text style={trail ? styles.rowValue : styles.rowPlaceholder} numberOfLines={1}>
              {trail ? trail.name : 'Add a trail (optional)'}
            </Text>
          </TouchableOpacity>
          {trail && !sending ? (
            <TouchableOpacity
              onPress={() => setTrail(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove the trail"
              testID="compose-clear-trail"
            >
              <Icon name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.row}>
          <Icon name="location-outline" size={20} color={Colors.primary} />
          <TextInput
            style={styles.placeInput}
            value={place}
            onChangeText={setPlace}
            placeholder="Add a place (optional), e.g. Ushguli"
            placeholderTextColor={Colors.textLight}
            maxLength={MAX_PLACE_LENGTH}
            editable={!sending}
            accessibilityLabel="Place"
            testID="compose-place"
          />
        </View>

        {progress ? (
          <View style={styles.progress}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        ) : (
          <Text style={styles.note}>Everyone on Kvali can see your post.</Text>
        )}
      </ScrollView>

      <TrailPickerSheet
        visible={pickingTrail}
        onClose={() => setPickingTrail(false)}
        onPick={(picked: PickedTrail) => setTrail({ id: picked.id, name: picked.name_en })}
      />
      <ActionSheet
        visible={choosingSource}
        title="Add photos"
        options={[
          { key: 'camera', label: 'Take a photo', icon: 'camera-outline' },
          { key: 'library', label: room > 1 ? `Choose up to ${room} photos` : 'Choose a photo', icon: 'images-outline' },
        ]}
        onSelect={(key) => (key === 'camera' ? takePhoto() : pickPhotos())}
        onClose={() => setChoosingSource(false)}
        closeOnSelect
      />
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      padding: 16,
      gap: 14,
    },
    submit: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.primary,
    },
    body: {
      minHeight: 140,
      fontSize: 16,
      lineHeight: 23,
      color: Colors.text,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    count: {
      alignSelf: 'flex-end',
      fontSize: 12,
      color: Colors.textLight,
      marginTop: -8,
    },
    photos: {
      gap: 10,
      paddingVertical: 2,
    },
    thumbWrap: {
      width: 92,
      height: 92,
    },
    thumb: {
      width: 92,
      height: 92,
      borderRadius: 12,
      backgroundColor: Colors.borderLight,
    },
    remove: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    addPhoto: {
      width: 92,
      height: 92,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    addPhotoText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    rowMain: {
      flex: 1,
      paddingVertical: 14,
    },
    rowValue: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
    },
    rowPlaceholder: {
      fontSize: 15,
      color: Colors.textLight,
    },
    placeInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: Colors.text,
    },
    progress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    note: {
      fontSize: 13,
      color: Colors.textLight,
    },
  });
