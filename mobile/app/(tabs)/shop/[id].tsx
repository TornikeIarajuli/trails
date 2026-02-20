import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useProduct } from '../../../hooks/useShop';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { data: product, isLoading } = useProduct(id);

  if (isLoading || !product) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.placeholder]}>
            <Ionicons name="image-outline" size={48} color={Colors.textLight} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.name}>{product.name}</Text>

          {product.price && <Text style={styles.price}>{product.price}</Text>}

          {product.shop_name && (
            <View style={styles.shopBadge}>
              <Ionicons name="storefront-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.shopName}>{product.shop_name}</Text>
            </View>
          )}

          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}
        </View>
      </ScrollView>

      {product.external_url && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.visitButton}
            onPress={() => Linking.openURL(product.external_url!)}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.visitButtonText}>Visit Shop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    heroImage: {
      width: '100%',
      height: 300,
    },
    placeholder: {
      backgroundColor: Colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButton: {
      position: 'absolute',
      left: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    content: {
      padding: 20,
    },
    name: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 8,
    },
    price: {
      fontSize: 20,
      fontWeight: '800',
      color: Colors.primary,
      marginBottom: 8,
    },
    shopBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    shopName: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors.textSecondary,
    },
    loadingText: {
      color: Colors.textLight,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 60,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: Colors.surface,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    visitButton: {
      backgroundColor: Colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    visitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
