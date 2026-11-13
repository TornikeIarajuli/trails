import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../constants/colors';
import { formatPrice } from '../../utils/formatters';
import type { Product } from '../../types/product';

interface GearProductsSheetProps {
  title: string | null;
  products: Product[];
  onClose: () => void;
}

async function openShop(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', 'This shop link could not be opened on your device.');
  }
}

/** Shop products for one checklist item, opened from the gear list. */
export function GearProductsSheet({ title, products, onClose }: GearProductsSheetProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title} in the shop
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {products.map((p) => {
            const price = formatPrice(p.price);
            const url = p.external_url;
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.row}
                disabled={!url}
                onPress={() => url && openShop(url)}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={[p.name, price, p.shop_name].filter(Boolean).join(', ')}
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.image} cachePolicy="memory-disk" transition={150} />
                ) : (
                  <View style={[styles.image, styles.placeholder]}>
                    <Ionicons name="image-outline" size={20} color={Colors.textLight} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[price, p.shop_name].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {url ? <Ionicons name="open-outline" size={18} color={Colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.disclaimer}>Independent Georgian shops. Prices and stock can change; check on their site.</Text>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      maxHeight: '70%',
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 12,
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: Colors.text,
    },
    list: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      backgroundColor: Colors.card,
    },
    image: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: '#FFFFFF',
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.borderLight,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    meta: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    disclaimer: {
      fontSize: 12,
      color: Colors.textLight,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
  });
