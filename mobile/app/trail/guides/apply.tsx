import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TrailPickerSheet } from '../../../components/trail/TrailPickerSheet';
import { useColors, ColorPalette } from '../../../constants/colors';
import { useMyGuideProfile, useSaveGuideProfile } from '../../../hooks/useGuides';
import { GUIDE_LANGUAGES, GUIDE_REGIONS, guideFormErrors } from '../../../utils/guides';
import { getErrorMessage } from '../../../utils/showError';
import { haptics } from '../../../utils/haptics';
import type { GuideProfileInput, GuideStatus } from '../../../services/guides';

const STATUS_TEXT: Record<GuideStatus, { title: string; text: string }> = {
  pending: { title: 'Waiting for review', text: 'The Kvali team checks every guide. You hear back in Alerts, usually within a few days.' },
  verified: { title: 'Listed', text: 'Hikers find you under Local guides and on the trails you picked.' },
  rejected: { title: 'Not approved yet', text: 'Change what the note asks and send it again.' },
  paused: { title: 'Paused', text: 'Your listing is hidden. Turn it back on below.' },
};

/** Become a guide, or edit your guide profile: what hikers see, and how they reach you. */
export default function GuideApplyScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { data: mine, isLoading } = useMyGuideProfile();
  const save = useSaveGuideProfile();
  const filled = useRef(false);

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['Georgian']);
  const [certifications, setCertifications] = useState('');
  const [price, setPrice] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState(true);
  const [telegram, setTelegram] = useState('');
  const [trails, setTrails] = useState<{ id: string; name: string }[]>([]);
  const [active, setActive] = useState(true);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!mine || filled.current) return;
    filled.current = true;
    setHeadline(mine.headline);
    setBio(mine.bio);
    setRegions(mine.regions);
    setLanguages(mine.languages);
    setCertifications(mine.certifications ?? '');
    setPrice(mine.price_gel != null ? String(mine.price_gel) : '');
    setPriceNote(mine.price_note ?? '');
    setPhone(mine.contact_phone ?? '');
    setWhatsapp(mine.contact_whatsapp);
    setTelegram(mine.contact_telegram ?? '');
    setTrails(mine.trails.map((t) => ({ id: t.id, name: t.name_en })));
    setActive(mine.status !== 'paused');
  }, [mine]);

  if (isLoading) return <LoadingSpinner />;

  const toggle = (list: string[], value: string, set: (next: string[]) => void) => {
    haptics.select();
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const submit = () => {
    const priceNumber = price.trim() ? Number(price.replace(/[^0-9]/g, '')) : null;
    const input: GuideProfileInput = {
      headline: headline.trim(),
      bio: bio.trim(),
      regions,
      languages,
      certifications: certifications.trim() || null,
      price_gel: priceNumber != null && Number.isFinite(priceNumber) ? priceNumber : null,
      price_note: priceNote.trim() || null,
      contact_phone: phone.trim() || null,
      contact_whatsapp: whatsapp && !!phone.trim(),
      contact_telegram: telegram.trim().replace(/^@/, '') || null,
      trail_ids: trails.map((t) => t.id),
      ...(mine ? { active } : {}),
    };
    const errors = Object.values(guideFormErrors(input));
    if (errors.length) {
      Alert.alert('Almost there', errors.join('\n'));
      return;
    }
    save.mutate(input, {
      onSuccess: (saved) => {
        haptics.success();
        Alert.alert(
          mine ? 'Saved' : 'Application sent',
          saved.status === 'pending' ? STATUS_TEXT.pending.text : 'Your guide profile is up to date.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      },
      onError: (err) => Alert.alert("Couldn't save", getErrorMessage(err)),
    });
  };

  const status = mine?.status;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: mine ? 'Your guide profile' : 'Become a guide',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {status ? (
          <View style={[styles.status, status === 'rejected' && styles.statusWarn]} testID="guide-status">
            <Text style={styles.statusTitle}>{STATUS_TEXT[status].title}</Text>
            <Text style={styles.statusText}>{STATUS_TEXT[status].text}</Text>
            {status === 'rejected' && mine?.admin_note ? <Text style={styles.statusNote}>Note: {mine.admin_note}</Text> : null}
          </View>
        ) : (
          <Text style={styles.intro}>
            Guide hikers on the trails you know. The Kvali team checks every guide before listing them. Hikers send you
            requests in the app; your phone is shared only with those you accept. No fees.
          </Text>
        )}

        <Text style={styles.label}>Headline</Text>
        <TextInput style={styles.input} value={headline} onChangeText={setHeadline} maxLength={80} placeholder="e.g. Mountain guide in Svaneti, 8 years" placeholderTextColor={Colors.textLight} testID="guide-headline" />

        <Text style={styles.label}>About you</Text>
        <TextInput style={[styles.input, styles.multiline]} value={bio} onChangeText={setBio} maxLength={2000} multiline placeholder="Your experience, the hikes you lead, what's included…" placeholderTextColor={Colors.textLight} testID="guide-bio" />

        <Text style={styles.label}>Regions</Text>
        <View style={styles.chips}>
          {GUIDE_REGIONS.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, regions.includes(r) && styles.chipActive]} onPress={() => toggle(regions, r, setRegions)} accessibilityRole="button" accessibilityState={{ selected: regions.includes(r) }} testID={`guide-region-${r}`}>
              <Text style={[styles.chipText, regions.includes(r) && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Languages</Text>
        <View style={styles.chips}>
          {GUIDE_LANGUAGES.map((l) => (
            <TouchableOpacity key={l} style={[styles.chip, languages.includes(l) && styles.chipActive]} onPress={() => toggle(languages, l, setLanguages)} accessibilityRole="button" accessibilityState={{ selected: languages.includes(l) }}>
              <Text style={[styles.chipText, languages.includes(l) && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Trails you guide (optional)</Text>
        {trails.map((t) => (
          <View key={t.id} style={styles.trailRow}>
            <Icon name="trail-sign-outline" size={16} color={Colors.primary} />
            <Text style={styles.trailName} numberOfLines={1}>{t.name}</Text>
            <TouchableOpacity onPress={() => setTrails(trails.filter((x) => x.id !== t.id))} hitSlop={8} accessibilityLabel={`Remove ${t.name}`}>
              <Icon name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRow} onPress={() => setPicking(true)} accessibilityRole="button" testID="guide-add-trail">
          <Icon name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.addText}>Add a trail</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Certifications (optional)</Text>
        <TextInput style={styles.input} value={certifications} onChangeText={setCertifications} maxLength={300} placeholder="e.g. Georgian Mountain Guide Association, first aid" placeholderTextColor={Colors.textLight} />

        <Text style={styles.label}>Price (optional)</Text>
        <View style={styles.priceRow}>
          <TextInput style={[styles.input, styles.priceInput]} value={price} onChangeText={setPrice} keyboardType="number-pad" maxLength={6} placeholder="250" placeholderTextColor={Colors.textLight} testID="guide-price" />
          <Text style={styles.currency}>GEL a day</Text>
        </View>
        <TextInput style={styles.input} value={priceNote} onChangeText={setPriceNote} maxLength={200} placeholder="e.g. for up to 6 people, transport extra" placeholderTextColor={Colors.textLight} />

        <Text style={styles.label}>Contact, for hikers you accept</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} placeholder="+995 5xx xx xx xx" placeholderTextColor={Colors.textLight} testID="guide-phone" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>This number is on WhatsApp</Text>
          <Switch value={whatsapp} onValueChange={setWhatsapp} trackColor={{ true: Colors.primary }} />
        </View>
        <TextInput style={styles.input} value={telegram} onChangeText={setTelegram} autoCapitalize="none" maxLength={41} placeholder="Telegram username (optional)" placeholderTextColor={Colors.textLight} />

        {mine && (status === 'verified' || status === 'paused') ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show me under Local guides</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.primary }} testID="guide-active" />
          </View>
        ) : null}

        <Button title={mine ? 'Save' : 'Send application'} onPress={submit} loading={save.isPending} />
      </ScrollView>

      <TrailPickerSheet
        visible={picking}
        title="Which trail do you guide?"
        onClose={() => setPicking(false)}
        onPick={(t) => setTrails((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, { id: t.id, name: t.name_en }]))}
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
      gap: 8,
    },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    status: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: Colors.primary + '14',
      gap: 4,
    },
    statusWarn: {
      backgroundColor: Colors.warning + '22',
    },
    statusTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
    },
    statusText: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
    statusNote: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.text,
    },
    label: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textSecondary,
    },
    input: {
      padding: 12,
      fontSize: 15,
      color: Colors.text,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    multiline: {
      minHeight: 110,
      textAlignVertical: 'top',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
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
      color: Colors.text,
    },
    chipTextActive: {
      color: Colors.textOnPrimary,
      fontWeight: '700',
    },
    trailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    trailName: {
      flex: 1,
      fontSize: 15,
      color: Colors.text,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    addText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    priceInput: {
      width: 120,
    },
    currency: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    switchLabel: {
      fontSize: 15,
      color: Colors.text,
    },
  });
