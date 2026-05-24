export const metadata = { title: 'Privacy Policy – Sama Construction' }

export default function PrivacyPage() {
  const updated = 'May 23, 2025'

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm">SC</span>
            </div>
            <span className="text-slate-500 text-sm font-medium">Sama Construction</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-slate-500 text-sm mt-2">Last updated: {updated}</p>
        </div>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Overview</h2>
            <p className="text-slate-600">
              Sama Construction (&ldquo;the Application&rdquo;) is an internal business management system
              operated by <strong>Sama Alostoura Building Contracting LLC</strong>, a company registered
              in Dubai, United Arab Emirates. This policy explains how we collect, use, and protect
              information accessed through this application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. Data We Access</h2>
            <p className="text-slate-600 mb-2">
              This application connects to <strong>QuickBooks Online</strong> via Intuit&rsquo;s OAuth 2.0
              API solely to read financial data belonging to Sama Alostoura Building Contracting LLC.
              Specifically, we access:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Invoice records (amounts, due dates, balances)</li>
              <li>Payment records</li>
              <li>Customer names and contact information linked to invoices</li>
              <li>Company account information (company name, realm ID)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. How We Use the Data</h2>
            <p className="text-slate-600 mb-2">
              All data retrieved from QuickBooks Online is used exclusively for internal business operations:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Displaying financial dashboards and cash-flow reports to authorised company staff</li>
              <li>Generating AI-assisted financial briefings for management decisions</li>
              <li>Tracking outstanding invoices and payment schedules</li>
            </ul>
            <p className="text-slate-600 mt-2">
              We do <strong>not</strong> sell, share, or transfer any data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Data Storage</h2>
            <p className="text-slate-600">
              OAuth tokens are stored securely on the application server in an encrypted file accessible
              only to authorised system administrators. Cached financial data is stored locally and is
              refreshed on-demand. No QuickBooks data is written to external databases or transmitted
              outside the company&rsquo;s infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Data Retention</h2>
            <p className="text-slate-600">
              Cached QuickBooks data is retained only as long as needed for operational purposes and is
              overwritten on each sync. OAuth tokens are deleted immediately upon disconnecting the
              integration via the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. Access Control</h2>
            <p className="text-slate-600">
              Access to this application is restricted to employees and authorised contractors of
              Sama Alostoura Building Contracting LLC. The application is operated on private
              infrastructure and is not publicly accessible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. Third-Party Services</h2>
            <p className="text-slate-600">
              This application integrates with the following third-party services, each governed by
              their own privacy policies:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>
                <strong>Intuit QuickBooks Online</strong> —{' '}
                <a href="https://www.intuit.com/privacy/statement/" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline">intuit.com/privacy/statement</a>
              </li>
              <li>
                <strong>Anthropic Claude API</strong> — used for AI-assisted briefings;
                financial data excerpts may be processed by Anthropic&rsquo;s API in accordance with
                Anthropic&rsquo;s{' '}
                <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline">Privacy Policy</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Your Rights</h2>
            <p className="text-slate-600">
              As this application is an internal tool, data subjects are employees of Sama Alostoura
              Building Contracting LLC. Any requests to access, correct, or delete data should be
              directed to the system administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">9. Changes to This Policy</h2>
            <p className="text-slate-600">
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top of
              this page reflects when material changes were last made.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">10. Contact</h2>
            <p className="text-slate-600">
              For any questions regarding this privacy policy, contact:
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg px-4 py-3 text-slate-700">
              <p className="font-medium">Sama Alostoura Building Contracting LLC</p>
              <p>Dubai, United Arab Emirates</p>
            </div>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
          <a href="/" className="text-sm text-brand-500 hover:underline">← Back to Dashboard</a>
          <a href="/terms" className="text-sm text-slate-500 hover:underline">Terms of Service →</a>
        </div>
      </div>
    </div>
  )
}
