export const metadata = { title: 'Terms of Service – Sama Construction' }

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-slate-500 text-sm mt-2">Last updated: {updated}</p>
        </div>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Acceptance of Terms</h2>
            <p className="text-slate-600">
              By accessing or using Sama Construction (&ldquo;the Application&rdquo;), you agree to be bound
              by these Terms of Service. The Application is operated by{' '}
              <strong>Sama Alostoura Building Contracting LLC</strong>, Dubai, United Arab Emirates.
              If you do not agree to these terms, you must not use the Application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. Authorised Use</h2>
            <p className="text-slate-600 mb-2">
              This Application is an internal tool intended exclusively for use by:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Employees of Sama Alostoura Building Contracting LLC</li>
              <li>Contractors or agents expressly authorised in writing by company management</li>
            </ul>
            <p className="text-slate-600 mt-2">
              Unauthorised access is strictly prohibited and may be subject to legal action under
              applicable UAE law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. QuickBooks Integration</h2>
            <p className="text-slate-600">
              The Application connects to Intuit QuickBooks Online using OAuth 2.0 on behalf of
              Sama Alostoura Building Contracting LLC. By using this integration, you acknowledge:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2 mt-2">
              <li>Only the company&rsquo;s own QuickBooks account data is accessed</li>
              <li>The integration reads financial data (invoices, payments, customers) for internal reporting</li>
              <li>No write operations are performed on QuickBooks data</li>
              <li>Access tokens are stored securely and used solely for this purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Intellectual Property</h2>
            <p className="text-slate-600">
              All software, design, and content within this Application is the property of
              Sama Alostoura Building Contracting LLC. You may not copy, reproduce, distribute,
              or create derivative works without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Data Accuracy</h2>
            <p className="text-slate-600">
              Financial figures and AI-generated briefings displayed in the Application are for
              informational purposes only. They do not constitute professional financial, legal,
              or accounting advice. All decisions based on Application data remain the sole
              responsibility of authorised users. Users should verify critical figures against
              source systems (QuickBooks, Supabase) before making business decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. AI-Generated Content</h2>
            <p className="text-slate-600">
              This Application uses the Anthropic Claude API to generate summaries, briefings, and
              recommendations. AI-generated content may contain errors or omissions. It is provided
              as a decision-support tool only and should not replace professional judgment. The
              company accepts no liability for actions taken solely on the basis of AI-generated output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. Limitation of Liability</h2>
            <p className="text-slate-600">
              To the maximum extent permitted by UAE law, Sama Alostoura Building Contracting LLC
              shall not be liable for any indirect, incidental, or consequential damages arising
              from use of this Application, including data loss, business interruption, or errors
              in AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Security Responsibilities</h2>
            <p className="text-slate-600">
              Users are responsible for maintaining the confidentiality of their access credentials.
              Any suspected unauthorised access must be reported immediately to the system administrator.
              Users must not share login credentials or access tokens with any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">9. Governing Law</h2>
            <p className="text-slate-600">
              These Terms of Service are governed by and construed in accordance with the laws of
              the <strong>United Arab Emirates</strong>. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of Dubai, UAE.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">10. Amendments</h2>
            <p className="text-slate-600">
              We reserve the right to modify these Terms at any time. Continued use of the Application
              after changes are posted constitutes acceptance of the revised Terms. The &ldquo;Last updated&rdquo;
              date at the top reflects when material changes were last made.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">11. Contact</h2>
            <p className="text-slate-600">
              Questions about these Terms should be directed to:
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg px-4 py-3 text-slate-700">
              <p className="font-medium">Sama Alostoura Building Contracting LLC</p>
              <p>Dubai, United Arab Emirates</p>
            </div>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
          <a href="/" className="text-sm text-brand-500 hover:underline">← Back to Dashboard</a>
          <a href="/privacy" className="text-sm text-slate-500 hover:underline">Privacy Policy →</a>
        </div>
      </div>
    </div>
  )
}
