export const metadata = { title: "Privacy Policy - Mikiri Trails" };

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 12, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Information We Collect</h2>
          <p>When you use Mikiri Trails, we collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> email address, username, and profile photo when you create an account.</li>
            <li><strong>Location data:</strong> GPS coordinates during active hikes to track your progress and record your route. Location is only collected while you are actively using the hiking feature.</li>
            <li><strong>Photos:</strong> images you upload as trail photos or proof of completion.</li>
            <li><strong>Usage data:</strong> trail completions, reviews, bookmarks, and social interactions (follows, likes).</li>
            <li><strong>Device information:</strong> device type, operating system, and push notification tokens.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and improve the hiking experience, including trail tracking and checkpoint verification.</li>
            <li>To display your profile, completions, and reviews to other users.</li>
            <li>To send push notifications about achievements, badges, and trail updates.</li>
            <li>To generate leaderboards and community features.</li>
            <li>To maintain and improve the security of our services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. Data Storage and Security</h2>
          <p>Your data is stored securely using Supabase (hosted on AWS) with encryption at rest and in transit. Photos are stored in secure cloud storage. We implement row-level security policies to ensure users can only access their own data.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Sharing</h2>
          <p>We do not sell your personal data. Your information may be visible to other users as follows:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your username, profile photo, and trail completions are publicly visible.</li>
            <li>Your reviews and trail photos are visible to all users.</li>
            <li>Your exact GPS route data is not shared with other users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Location Data</h2>
          <p>We only access your location when you explicitly start a hike. Location tracking stops when you end the hike. You can deny location permissions at any time through your device settings, though this will limit hiking functionality.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access and download your personal data.</li>
            <li>Delete your account and all associated data.</li>
            <li>Opt out of push notifications.</li>
            <li>Update or correct your profile information.</li>
          </ul>
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
