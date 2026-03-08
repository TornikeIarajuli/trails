import React, { useMemo } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';

export default function TermsOfServiceScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Terms of Service',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        <Section title="1. Acceptance of Terms" styles={styles}>
          By creating an account or using the Georgia Trails app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.
        </Section>

        <Section title="2. Description of Service" styles={styles}>
          Georgia Trails is a mobile application for discovering, tracking, and sharing hiking trails in Georgia (the country). Features include trail browsing, GPS-tracked hike recording, completion verification, community photos, trail condition reports, group hike events, and a badge/leaderboard system.
        </Section>

        <Section title="3. User Accounts" styles={styles}>
          You must be at least 13 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account.{'\n\n'}
          You agree to provide accurate information when registering and to keep your profile information up to date. We reserve the right to suspend or terminate accounts that violate these Terms.
        </Section>

        <Section title="4. User Conduct" styles={styles}>
          You agree not to:{'\n'}
          • Post false, misleading, or harmful trail condition reports{'\n'}
          • Upload photos or content that is offensive, illegal, or violates the rights of others{'\n'}
          • Harass, threaten, or abuse other users{'\n'}
          • Attempt to manipulate the leaderboard, badges, or completion system through fraudulent means{'\n'}
          • Use the app for any unlawful purpose{'\n'}
          • Attempt to reverse-engineer, hack, or disrupt the app or its servers
        </Section>

        <Section title="5. Trail Completions & Badges" styles={styles}>
          Trail completions require a valid GPS-verified photo at or near the trail endpoint. We reserve the right to reject or remove completions that appear fraudulent.{'\n\n'}
          Badges and rankings are earned through legitimate use of the app. Any attempt to manipulate the system may result in account suspension and removal of badges.
        </Section>

        <Section title="6. Community Content" styles={styles}>
          By submitting photos, reviews, comments, or trail condition reports, you grant Georgia Trails a non-exclusive, royalty-free license to display that content within the app.{'\n\n'}
          You retain ownership of content you submit. You are solely responsible for the accuracy and legality of content you post. We may remove any content that violates these Terms without notice.
        </Section>

        <Section title="7. Safety Disclaimer" styles={styles}>
          Hiking involves inherent risks including injury, adverse weather, and dangerous terrain. Georgia Trails provides information for reference purposes only.{'\n\n'}
          Trail conditions, difficulty ratings, and route information may not be current or accurate. Always check official sources before hiking, carry appropriate gear, and inform someone of your plans.{'\n\n'}
          Georgia Trails is not responsible for any injury, loss, or damage arising from your use of the app or participation in hiking activities.
        </Section>

        <Section title="8. Emergency SOS" styles={styles}>
          The in-app SOS feature is provided as a convenience to initiate an emergency call. It does not guarantee connection to emergency services. Always have a backup method to contact emergency services and carry a fully charged device.
        </Section>

        <Section title="9. Intellectual Property" styles={styles}>
          The Georgia Trails app, its design, logo, and original content are owned by GZA Trails and are protected by copyright and intellectual property laws. You may not copy, reproduce, or redistribute any part of the app without our written permission.{'\n\n'}
          Trail data and map information may be sourced from third-party providers and is subject to their respective terms.
        </Section>

        <Section title="10. Limitation of Liability" styles={styles}>
          To the maximum extent permitted by law, Georgia Trails and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app, including but not limited to personal injury, property damage, data loss, or trail navigation errors.
        </Section>

        <Section title="11. Changes to Terms" styles={styles}>
          We reserve the right to modify these Terms at any time. We will notify users of material changes via push notification or in-app message. Continued use of the app after changes are posted constitutes your acceptance of the revised Terms.
        </Section>

        <Section title="12. Governing Law" styles={styles}>
          These Terms are governed by the laws of Georgia (the country). Any disputes arising from these Terms or your use of the app shall be subject to the jurisdiction of the courts of Tbilisi, Georgia.
        </Section>

        <Section title="13. Contact" styles={styles}>
          For questions about these Terms, please contact:{'\n\n'}
          support@gzatrails.com
        </Section>
      </ScrollView>
    </>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: any }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 48,
    },
    updated: {
      fontSize: 12,
      color: Colors.textLight,
      marginBottom: 20,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 8,
    },
    body: {
      fontSize: 14,
      lineHeight: 22,
      color: Colors.textSecondary,
    },
  });
