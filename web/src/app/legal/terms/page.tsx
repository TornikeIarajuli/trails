export const metadata = { title: "Terms of Service - Mikiri Trails" };

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 12, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>By downloading, installing, or using the Mikiri Trails mobile application (&quot;App&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
          <p>Mikiri Trails is a hiking companion app for trails in Georgia. The App allows users to discover trails, track hikes with GPS, complete checkpoints, earn badges, write reviews, and interact with other hikers.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. Account Registration</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You must create an account to use core features of the App.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must provide accurate information when creating your account.</li>
            <li>You must be at least 13 years old to create an account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. User Content</h2>
          <p>You retain ownership of content you submit (photos, reviews, profile information). By submitting content, you grant Mikiri Trails a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the App and for promotional purposes.</p>
          <p className="mt-2">You agree not to submit content that is:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Illegal, harmful, threatening, or harassing.</li>
            <li>Fraudulent or misleading (e.g., fake trail completions or reviews).</li>
            <li>Infringing on the intellectual property rights of others.</li>
            <li>Spam or unsolicited advertising.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Trail Safety</h2>
          <p>Mikiri Trails provides trail information for reference only. You acknowledge that:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Trail conditions may change and may not be reflected in the App.</li>
            <li>You are solely responsible for your own safety while hiking.</li>
            <li>GPS tracking and checkpoint distances are approximate and should not be relied upon for navigation.</li>
            <li>You should always carry appropriate gear, supplies, and a backup navigation method.</li>
            <li>Mikiri Trails is not a substitute for proper trail maps or navigation tools.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the App for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to the App or its systems.</li>
            <li>Interfere with or disrupt the App or servers.</li>
            <li>Scrape, crawl, or collect data from the App without permission.</li>
            <li>Impersonate other users or create fake accounts.</li>
            <li>Use GPS spoofing or other methods to fake trail completions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Intellectual Property</h2>
          <p>The App, including its design, features, trail data, and branding, is the property of Mikiri Trails. You may not copy, modify, distribute, or create derivative works based on the App without permission.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Termination</h2>
          <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time. Upon termination, your right to use the App ceases immediately, though we may retain certain data as required by law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">9. Disclaimers</h2>
          <p>The App is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not guarantee that the App will be error-free, uninterrupted, or that trail information will be accurate or up to date.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Mikiri Trails shall not be liable for any indirect, incidental, special, or consequential damages, including but not limited to personal injury, property damage, or data loss arising from your use of the App or reliance on trail information.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">11. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the App after changes constitutes acceptance of the updated terms. We will notify you of significant changes through the App.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact</h2>
          <p>If you have questions about these terms, contact us at <a href="mailto:support@mikiritrails.com" className="text-blue-600 underline">support@mikiritrails.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
