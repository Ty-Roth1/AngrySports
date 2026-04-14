export const metadata = { title: 'Privacy Policy – 12AM' }

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-gray-300">
      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 13, 2025</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-white mb-2">Overview</h2>
          <p>
            12AM ("the App") is a private fantasy baseball platform. This policy explains what
            information we collect, how we use it, and your rights regarding your data.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">Information We Collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Email address and display name used to create your account</li>
            <li>Fantasy team and league activity (roster moves, trades, scores)</li>
            <li>Chat messages sent within the app</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To operate your account and fantasy league</li>
            <li>To display scores, standings, and league activity</li>
            <li>We do not sell or share your data with third parties</li>
            <li>We do not use your data for advertising</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">Data Storage</h2>
          <p>
            Your data is stored securely using Supabase (PostgreSQL). We retain your data
            for as long as your account is active. You may request deletion at any time.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">Third-Party Services</h2>
          <p>
            The app uses Supabase for authentication and data storage. No other third-party
            analytics or tracking services are used.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">Children's Privacy</h2>
          <p>
            The app is not directed at children under 13. We do not knowingly collect
            information from children under 13.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">Contact</h2>
          <p>
            For questions or data deletion requests, contact us at{' '}
            <a href="mailto:rothty713@icloud.com" className="text-red-400 hover:underline">
              rothty713@icloud.com
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}
