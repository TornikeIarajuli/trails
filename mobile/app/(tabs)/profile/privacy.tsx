import React, { useMemo } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useColors, ColorPalette } from '../../../constants/colors';

export default function PrivacyPolicyScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        <Section title="1. Introduction" styles={styles}>
          Georgia Trails ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use the Georgia Trails mobile application.
        </Section>

        <Section title="2. Information We Collect" styles={styles}>
          <Bold styles={styles}>Account Information:</Bold> When you register, we collect your email address, username, and optional profile details such as a bio and avatar photo.{'\n\n'}
          <Bold styles={styles}>Location Data:</Bold> With your permission, we collect GPS coordinates during active hikes to track your route, calculate distance, and verify trail completions. Location tracking is only active while you are recording a hike.{'\n\n'}
          <Bold styles={styles}>Activity Data:</Bold> We store your completed hikes, trail reviews, condition reports, community photos, and badge achievements.{'\n\n'}
          <Bold styles={styles}>Contact Information:</Bold> If you choose to add contact info to your profile (e.g. phone or Telegram), it is displayed only to other users who view your profile.{'\n\n'}
          <Bold styles={styles}>Device Data:</Bold> We collect push notification tokens to send you relevant alerts. We do not collect device identifiers for advertising purposes.
        </Section>

        <Section title="3. How We Use Your Information" styles={styles}>
          • To provide and operate the app{'\n'}
          • To verify trail completions and award badges{'\n'}
          • To display your activity on leaderboards and your profile{'\n'}
          • To send push notifications about hike events, badge awards, and comments{'\n'}
          • To improve app performance and fix bugs{'\n'}
          • To respond to support requests
        </Section>

        <Section title="4. Data Sharing" styles={styles}>
          We do not sell or rent your personal data to third parties.{'\n\n'}
          Your username, profile photo, completed trails, and badges are visible to other users of the app. Your email address is never shown publicly.{'\n\n'}
          We use Supabase as our database and authentication provider, and Render for backend hosting. These services process your data on our behalf and are bound by their own privacy policies.
        </Section>

        <Section title="5. Data Retention" styles={styles}>
          Your data is retained for as long as your account is active. You may delete your account at any time from Settings → Delete Account. Upon deletion, all your personal data, hike history, reviews, and photos are permanently removed within 30 days.{'\n\n'}
          Trail condition reports are automatically deactivated after 14 days.
        </Section>

        <Section title="6. Security" styles={styles}>
          We use industry-standard security practices including encrypted connections (HTTPS/TLS), hashed passwords, and row-level security on our database. However, no method of transmission over the internet is 100% secure.
        </Section>

        <Section title="7. Children's Privacy" styles={styles}>
          Georgia Trails is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.
        </Section>

        <Section title="8. Your Rights" styles={styles}>
          You have the right to:{'\n'}
          • Access the personal data we hold about you{'\n'}
          • Correct inaccurate data via your profile settings{'\n'}
          • Delete your account and all associated data{'\n'}
          • Withdraw consent for location tracking at any time via device settings
        </Section>

        <Section title="9. Changes to This Policy" styles={styles}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes via a push notification or in-app message. Continued use of the app after changes constitutes acceptance of the updated policy.
        </Section>

        <Section title="10. Contact Us" styles={styles}>
          If you have questions about this Privacy Policy, please contact us at:{'\n\n'}
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

function Bold({ children, styles }: { children: React.ReactNode; styles: any }) {
  return <Text style={styles.bold}>{children}</Text>;
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
    bold: {
      fontWeight: '700',
      color: Colors.text,
    },
  });
