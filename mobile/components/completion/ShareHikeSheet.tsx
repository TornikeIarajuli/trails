import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Sheet, SheetButton } from '../ui/Sheet';
import { useColors, ColorPalette } from '../../constants/colors';
import { haptics } from '../../utils/haptics';
import { ShareCard, ShareCardData, ShareCardHandle } from './ShareCard';

/**
 * "Share your hike": a preview of the picture (story-sized, for Instagram and the rest), then
 * the share sheet with the PNG. Sharing as text stays one tap away.
 */
export function ShareHikeSheet({
  visible,
  onClose,
  data,
  onShareText,
}: {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData;
  onShareText: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardRef = useRef<ShareCardHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Small enough to leave room for the buttons on any phone
  const previewWidth = Math.min(screenWidth - 96, (screenHeight * 0.48 * 1080) / 1920, 320);

  const sharePicture = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const uri = await cardRef.current?.exportPng();
      if (!uri) throw new Error('No picture');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
      haptics.tap();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your hike', UTI: 'public.png' });
    } catch {
      setError("Couldn't make the picture on this phone. You can share your hike as text instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Share your hike"
      footer={
        <View style={styles.footer}>
          <SheetButton title="Share picture" onPress={sharePicture} loading={busy} disabled={busy} testID="share-picture" />
          <SheetButton
            title="Share as text"
            variant="secondary"
            onPress={() => {
              onClose();
              onShareText();
            }}
            disabled={busy}
            testID="share-text"
          />
        </View>
      }
    >
      <View style={styles.preview} testID="share-preview">
        <View style={styles.cardShadow}>
          <ShareCard ref={cardRef} data={data} width={previewWidth} />
        </View>
        <Text style={styles.hint}>Story size, for Instagram, WhatsApp and the rest.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Sheet>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    preview: {
      alignItems: 'center',
      gap: 10,
      paddingBottom: 8,
    },
    cardShadow: {
      borderRadius: 14,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    error: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.error,
      textAlign: 'center',
    },
    footer: {
      gap: 8,
    },
  });
