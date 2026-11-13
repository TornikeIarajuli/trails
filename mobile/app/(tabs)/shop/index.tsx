import React, { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
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
import { formatPrice } from '../../../utils/formatters';
import { availableCategories, filterProducts, shopNames } from '../../../utils/shopFilters';
import { haptics } from '../../../utils/haptics';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

const NO_PRODUCTS: Product[] = [];

export default function ShopScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { data: products, isLoading, isError, error, refetch, isRefetching } = useProducts();
  const all = products ?? NO_PRODUCTS;
  const [category, setCategory] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);

  const shops = useMemo(() => shopNames(all), [all]);
  const categories = useMemo(() => availableCategories(all, shop), [all, shop]);
  // A category can disappear when a shop is picked that doesn't sell it
  const activeCategory = categories.some((c) => c.key === category) ? category : null;
  const visible = useMemo(() => filterProducts(all, { category: activeCategory, shop }), [all, activeCategory, shop]);

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const filters = (
    <View style={styles.filters}>
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chip('all', 'All gear', !activeCategory, () => setCategory(null))}
          {categories.map((c) =>
            chip(c.key, c.label, activeCategory === c.key, () => setCategory(activeCategory === c.key ? null : c.key)),
          )}
        </ScrollView>
      )}
      {shops.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chip('all-shops', 'All shops', !shop, () => setShop(null))}
          {shops.map((name) => chip(`shop-${name}`, name, shop === name, () => setShop(shop === name ? null : name)))}
        </ScrollView>
      )}
      <Text style={styles.count}>
        {visible.length} {visible.length === 1 ? 'product' : 'products'} from Georgian shops
      </Text>
    </View>
  );

  const renderProduct = ({ item }: { item: Product }) => {
    const price = formatPrice(item.price);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={price ? `${item.name}, ${price}` : item.name}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          {price ? <Text style={styles.price}>{price}</Text> : null}
          {item.shop_name && <Text style={styles.shop}>{item.shop_name}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (isError && !products?.length) {
    return (
      <View style={styles.container}>
        <ErrorState
          error={error}
          title="Couldn't load the shop"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={all.length > 0 ? filters : null}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {all.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setCategory(null);
                  setShop(null);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.emptyText}>Nothing here yet. Show all products</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.emptyText}>No products available</Text>
            )}
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
    filters: {
      gap: 8,
      marginBottom: 12,
    },
    chipRow: {
      gap: 8,
      paddingRight: 12,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.text,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
    },
    count: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
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
