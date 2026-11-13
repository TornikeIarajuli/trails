export const metadata = { title: "Privacy Policy - Mikiri Trails" };

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: November 13, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Information We Collect</h2>
          <p>When you use Mikiri Trails, we collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> email address, username, and the optional profile details you add (name, bio, profile photo, contact details).</li>
            <li><strong>Location data:</strong> GPS coordinates while you record a hike, your position when you ask for trails near you, and your position when you trigger SOS. When you finish a hike, the recorded GPS track is sent to our servers and stored there to verify the completion.</li>
            <li><strong>Photos:</strong> images you upload as trail photos, proof of completion, or profile photo.</li>
            <li><strong>Activity:</strong> trail completions, reviews, trail condition reports, bookmarks, comments, likes, follows, the group hikes you create or join, and the emergency contact you choose.</li>
            <li><strong>Presence:</strong> the time you last had the App open (&quot;last seen&quot;).</li>
            <li><strong>Device information:</strong> device type, operating system, and push notification tokens.</li>
            <li><strong>Usage analytics:</strong> events that describe how the App is used (for example trails viewed, hikes started and finished, searches), linked to your user ID and email address.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and improve the hiking experience, including recording hikes and verifying completions from the recorded GPS track.</li>
            <li>To display your profile, completions, and reviews to other users.</li>
            <li>To send push notifications about badges, new followers, comments, group hikes, and SOS alerts from people who chose you as their emergency contact.</li>
            <li>To generate leaderboards and community features.</li>
            <li>To understand how the App is used and to find and fix errors.</li>
            <li>To maintain and improve the security of our services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. Service Providers and Storage</h2>
          <p>We use the following companies to run the App. They process data on our behalf, under their own terms and privacy policies:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Supabase:</strong> database, sign-in, and file storage for photos.</li>
            <li><strong>Render:</strong> hosting of the App&apos;s API.</li>
            <li><strong>Vercel:</strong> hosting of this website and of our administration panel.</li>
            <li><strong>Expo:</strong> delivery of push notifications (your push token and the content of each notification).</li>
            <li><strong>PostHog:</strong> product analytics, hosted in the United States (usage events, device information, and your user ID and email address as identifier).</li>
            <li><strong>Sentry:</strong> error logs from the API, which can include technical details of the request that failed.</li>
          </ul>
          <p className="mt-2">Data travels between the App and our servers over encrypted connections (HTTPS). Photos you upload are stored at public web addresses: anyone who has the link to a photo can open it without signing in.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Sharing</h2>
          <p>We do not sell your personal data. Your information is visible to other users as follows:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your public profile is visible to other users: username, name, profile photo, bio, any contact details you chose to add, badges, completed trails, and the time you were last active (&quot;last seen&quot;).</li>
            <li>Your reviews, trail photos, trail condition reports, comments, and group hikes are visible to all users.</li>
            <li>Your email address is not shown to other users.</li>
            <li>Your recorded GPS tracks are not shown to other users.</li>
            <li>If you trigger SOS, your current location is sent to your emergency contact. The person you choose as emergency contact is notified that you chose them.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Location Data</h2>
          <p>The App uses your location while you record a hike (including in the background until you end the hike, if you allow background access), when you ask for trails near you, and when you trigger SOS. You can withdraw location permission at any time in your device settings, though hikes can then no longer be recorded or verified.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access and download your personal data, using the export option in the App&apos;s settings.</li>
            <li>Delete your account and the data linked to it, using the delete option in the App&apos;s settings. Copies may remain in backups and in our service providers&apos; logs for a limited time.</li>
            <li>Opt out of push notifications.</li>
            <li>Update or correct your profile information.</li>
          </ul>
          <p className="mt-2">You can also contact us to exercise any of these rights.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Children&apos;s Privacy</h2>
          <p>Mikiri Trails is not intended for children under 13. We do not knowingly collect data from children under 13.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. We will notify you of significant changes through the app or via email.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
          <p>If you have questions about this privacy policy, contact us at <a href="mailto:support@mikiritrails.com" className="text-blue-600 underline">support@mikiritrails.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
