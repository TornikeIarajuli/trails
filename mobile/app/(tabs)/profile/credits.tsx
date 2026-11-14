import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Linking, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';
import photoCreditsJson from '../../../assets/data/photo-credits.json';
import { withBottomInset } from '../../../utils/insets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PhotoCredit {
  trail_id: string;
  trail_name: string;
  file: string;
  author: string;
  license: string;
  license_url: string;
  source_url: string;
}

// Filled by the content pipeline; may be empty
const PHOTO_CREDITS: PhotoCredit[] = (photoCreditsJson as unknown as PhotoCredit[]).filter(
  (c) => !!c && typeof c.author === 'string',
);

async function openLink(url: string | null | undefined) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', url);
  }
}

function Link({ url, children, style }: { url: string; children: React.ReactNode; style: object }) {
  return (
    <Text style={style} onPress={() => openLink(url)} accessibilityRole="link">
      {children}
    </Text>
  );
}

export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const header = (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Maps and trail routes</Text>
        <Text style={styles.body}>
          Trail routes, checkpoints and map data © OpenStreetMap contributors. The data is available
          under the Open Database License (ODbL).
        </Text>
        <Link url="https://www.openstreetmap.org/copyright" style={styles.link}>
          openstreetmap.org/copyright
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Topographic map</Text>
        <Text style={styles.body}>
          Map style © OpenTopoMap (CC-BY-SA); map data © OpenStreetMap contributors, SRTM. Topo map
          tiles come from OpenTopoMap's servers and are kept on this phone once viewed or saved.
        </Text>
        <Link url="https://opentopomap.org/about" style={styles.link}>
          opentopomap.org/about
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Icons</Text>
        <Text style={styles.body}>
          Hand-drawn icons from Sketchy Icons, © 2026 Julien Montagne (MIT License). Their shapes come
          from Lucide, © Lucide Icons and Contributors (ISC License), some originally from Feather, ©
          2013-present Cole Bemis (MIT License). The Svaneti tower badge was drawn for this app.
        </Text>
        <Link url="https://github.com/Fantomiald/sketchyicons" style={styles.link}>
          github.com/Fantomiald/sketchyicons
        </Link>
        <Link url="https://lucide.dev/license" style={styles.link}>
          lucide.dev/license
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elevation</Text>
        <Text style={styles.body}>
          Elevation data: NASA Shuttle Radar Topography Mission (SRTM).
        </Text>
      </View>

      <Text style={styles.listTitle}>Trail photos</Text>
      {PHOTO_CREDITS.length > 0 && (
        <Text style={styles.listHint}>
          Photos from Wikimedia Commons, used under the licences shown. Tap a link for the original.
        </Text>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Data sources & credits',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <FlatList
        style={styles.container}
        contentContainerStyle={withBottomInset(styles.content, insets.bottom)}
        data={PHOTO_CREDITS}
        keyExtractor={(item, index) => `${item.trail_id}-${item.file}-${index}`}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.credit}>
            <Text style={styles.creditTrail} numberOfLines={1}>{item.trail_name}</Text>
            <Text style={styles.creditAuthor}>Photo: {item.author}</Text>
            <View style={styles.creditLinks}>
              {item.license_url ? (
                <Link url={item.license_url} style={styles.link}>{item.license}</Link>
              ) : (
                <Text style={styles.body}>{item.license}</Text>
              )}
              {item.source_url ? (
                <Link url={item.source_url} style={styles.link}>Source</Link>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No third-party photos are used in the app at the moment.</Text>
        }
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
      paddingBottom: 40,
    },
    section: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      gap: 6,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    link: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
      textDecorationLine: 'underline',
    },
    listTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    listHint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    credit: {
      backgroundColor: Colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      gap: 2,
    },
    creditTrail: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
    },
    creditAuthor: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    creditLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginTop: 4,
    },
    empty: {
      fontSize: 14,
      color: Colors.textLight,
      paddingVertical: 16,
    },
  });
