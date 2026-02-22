import React, { useMemo } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useProducts } from '../../../hooks/useShop';
import { Product } from '../../../types/product';

export default function ShopScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: products, isLoading, refetch, isRefetching } = useProducts();

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
      activeOpacity={0.7}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {item.price && <Text style={styles.price}>{item.price}</Text>}
        {item.shop_name && <Text style={styles.shop}>{item.shop_name}</Text>}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products ?? []}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products available</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    list: {
      padding: 12,
    },
    row: {
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: Colors.card,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    image: {
      width: '100%',
      height: 140,
    },
    placeholder: {
      backgroundColor: Colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderText: {
      color: Colors.textLight,
      fontSize: 12,
    },
    info: {
      padding: 10,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: 4,
    },
    price: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.primary,
      marginBottom: 2,
    },
    shop: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyText: {
      color: Colors.textLight,
      fontSize: 14,
    },
  });
