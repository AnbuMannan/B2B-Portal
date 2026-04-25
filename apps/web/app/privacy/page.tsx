import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — B2B Marketplace',
  description: 'Privacy Policy in compliance with the Digital Personal Data Protection Act 2023 (DPDP Act)',
};

const LAST_UPDATED = '1 January 2024';
const POLICY_VERSION = 'v2024.1';
const GRIEVANCE_OFFICER = {
  name: 'Rajesh Kumar',
  title: 'Grievance Officer',
  email: 'grievance@b2bmarket.in',
  phone: '+91-80-4567-8901',
  address: 'B2B Marketplace Pvt. Ltd., MG Road, Bengaluru — 560001, Karnataka, India',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Last updated: {LAST_UPDATED} · Version: {POLICY_VERSION}
              </p>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              DPDP Act 2023 Compliant
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Manage Consents', href: '/privacy/consent', icon: '🛡️' },
              { label: 'Export My Data', href: '/privacy/data-export', icon: '📦' },
              { label: 'Delete Account', href: '/privacy/delete-account', icon: '🗑️' },
              { label: 'Grievance Officer', href: '/contact/grievance-officer', icon: '⚖️' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 prose prose-sm max-w-none">
          <Section title="1. About This Policy">
            <p>
              This Privacy Policy describes how B2B Marketplace Pvt. Ltd. (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;, &ldquo;Company&rdquo;) collects,
              uses, stores, and processes your personal data in compliance with the{' '}
              <strong>Digital Personal Data Protection Act 2023 (DPDP Act)</strong>, the IT Act 2000 (Section 79),
              Consumer Protection (E-Commerce) Rules 2020, and UIDAI Aadhaar guidelines.
            </p>
            <p>
              By using our platform you confirm that you have read and agree to this policy.
              This policy applies to all users — Sellers, Buyers, and visitors.
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left">Category</th>
                  <th className="border px-3 py-2 text-left">Data Points</th>
                  <th className="border px-3 py-2 text-left">Legal Basis (DPDP)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Identity', 'Name, email, mobile, password hash', '§7(a) — Contract performance'],
                  ['Business (Seller)', 'GST Number, PAN, IEC, Udyam, company name', '§7(b) — Legal obligation (GST Act, FEMA)'],
                  ['Aadhaar', 'Last 4 digits ONLY — full Aadhaar never stored', 'UIDAI circular — minimal data principle'],
                  ['KYC Documents', 'Photos/scans of certificates (encrypted at rest)', '§7(b) — Legal obligation (PMLA 2002)'],
                  ['Transaction', 'Orders, payments, invoices, wallet balance', '§7(b) — Legal obligation (IT Act, GST Act)'],
                  ['Usage', 'Pages visited, search queries, click events', '§6 — Explicit consent (Analytics)'],
                  ['Communications', 'Messages, enquiries, support tickets', '§7(a) — Contract performance'],
                  ['Technical', 'IP address, device type, browser, session tokens', '§7(a) — Essential for security'],
                ].map(([cat, data, basis]) => (
                  <tr key={cat}>
                    <td className="border px-3 py-2 font-medium">{cat}</td>
                    <td className="border px-3 py-2 text-gray-600">{data}</td>
                    <td className="border px-3 py-2 text-gray-500">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul>
              <li><strong>Account creation & management</strong> — Creating your seller/buyer profile, enabling login, and maintaining session security.</li>
              <li><strong>KYC verification</strong> — Verifying your business identity with GSTN, DGFT, and Income Tax APIs as required by applicable law.</li>
              <li><strong>Marketplace operations</strong> — Processing orders, payments (via Razorpay), issuing GST-compliant invoices, and revealing buyer contact details.</li>
              <li><strong>Communications</strong> — Sending transactional emails, SMS OTPs, and in-app notifications related to your account activity.</li>
              <li><strong>Marketing (with consent)</strong> — Promotional emails, product recommendations, and market updates. You may withdraw this consent at any time.</li>
              <li><strong>Analytics (with consent)</strong> — Improving platform performance, understanding feature usage. Fully anonymized after withdrawal.</li>
              <li><strong>Legal compliance</strong> — Retaining financial records for 7 years as required by the GST Act, IT Act, and PMLA.</li>
            </ul>
          </Section>

          <Section title="4. Your Rights Under the DPDP Act 2023">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
              {[
                { right: '§11 — Right to Information', desc: 'Know what data we hold about you and how it is used.', href: '/privacy/consent' },
                { right: '§12 — Right to Correction', desc: 'Correct inaccurate or incomplete personal data.', href: '/buyer/profile' },
                { right: '§12 — Right to Portability', desc: 'Download a copy of all your data as JSON.', href: '/privacy/data-export' },
                { right: '§13 — Right to Erasure', desc: 'Delete your account and anonymize personal data (financial records retained per GST law).', href: '/privacy/delete-account' },
                { right: '§6 — Right to Withdraw Consent', desc: 'Withdraw non-essential consents at any time.', href: '/privacy/consent' },
                { right: '§13 — Right to Grievance', desc: 'Lodge complaints with our Grievance Officer (72h SLA).', href: '/contact/grievance-officer' },
              ].map((r) => (
                <a key={r.right} href={r.href} className="block p-4 bg-blue-50 rounded-xl border border-blue-200 hover:border-blue-400 transition-colors">
                  <p className="text-xs font-bold text-blue-700">{r.right}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{r.desc}</p>
                </a>
              ))}
            </div>
          </Section>

          <Section title="5. Data Sharing & Third Parties">
            <p>We do not sell your personal data. We share data only in the following circumstances:</p>
            <ul>
              <li><strong>Government APIs:</strong> GSTN (GST verification), DGFT (IEC verification), Income Tax portal (PAN verification) — required for KYC.</li>
              <li><strong>Payment Gateway:</strong> Razorpay receives payment card/UPI data directly; we do not store raw payment credentials.</li>
              <li><strong>Cloud Infrastructure:</strong> Supabase (database, encrypted at rest), Vercel/Railway (application hosting) — data processed within India.</li>
              <li><strong>SMS Gateway:</strong> MSG91 processes mobile numbers for OTP delivery only.</li>
              <li><strong>Legal Requirement:</strong> Law enforcement or regulatory authorities when legally mandated.</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left">Data Type</th>
                  <th className="border px-3 py-2 text-left">Retention Period</th>
                  <th className="border px-3 py-2 text-left">Legal Basis</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Account / Profile PII', 'Until deletion request, then anonymized', 'DPDP Act §13'],
                  ['Financial records (invoices, GST)', '7 years from transaction date', 'GST Act §36, IT Act'],
                  ['KYC documents (raw scans)', 'Until account deletion, then hard-deleted', 'UIDAI guidelines'],
                  ['Audit logs', '7 years', 'IT Act §7A'],
                  ['Consent records', 'Lifetime of account + 3 years', 'DPDP Act §6'],
                  ['Session tokens', 'Until logout or 7 days, whichever first', 'Security requirement'],
                  ['Analytics data (anonymized)', '2 years, fully aggregated', 'With explicit consent'],
                ].map(([type, period, basis]) => (
                  <tr key={type}>
                    <td className="border px-3 py-2">{type}</td>
                    <td className="border px-3 py-2 text-gray-600">{period}</td>
                    <td className="border px-3 py-2 text-gray-500">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="7. Security Measures">
            <ul>
              <li>AES-256-GCM encryption for all PII fields stored in database.</li>
              <li>Passwords hashed with bcrypt (12 rounds) — plaintext never stored.</li>
              <li>HTTPS/TLS 1.3 enforced on all endpoints.</li>
              <li>JWT tokens with 4-hour expiry; refresh tokens stored hashed.</li>
              <li>Role-based access control — only authorized staff can access your data.</li>
              <li>Regular penetration testing and security audits.</li>
              <li>Full Aadhaar numbers are never collected or stored per UIDAI circular dated 28.05.2024.</li>
            </ul>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              Our platform is intended for businesses only. We do not knowingly collect personal data from
              individuals under 18 years of age. If you are under 18, please do not use this platform or
              provide any personal information.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this policy to reflect changes in law or our practices. Material changes will be
              notified via email and in-app notification at least 15 days before they take effect.
              Your continued use after the effective date constitutes acceptance.
            </p>
          </Section>

          {/* Grievance Officer — mandatory §13 disclosure */}
          <div className="mt-8 bg-amber-50 border-2 border-amber-300 rounded-xl p-6 not-prose">
            <h3 className="font-bold text-gray-900 mb-1">⚖️ Grievance Officer (DPDP Act §13 — Mandatory Disclosure)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Appointed under the Digital Personal Data Protection Act 2023. You may approach the Grievance Officer
              for any complaint or query regarding your personal data. A response will be provided within{' '}
              <strong>72 hours</strong> as mandated by law.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">Name</span><p className="font-semibold">{GRIEVANCE_OFFICER.name}</p></div>
              <div><span className="text-gray-500 text-xs">Designation</span><p className="font-semibold">{GRIEVANCE_OFFICER.title}</p></div>
              <div><span className="text-gray-500 text-xs">Email</span><a href={`mailto:${GRIEVANCE_OFFICER.email}`} className="text-blue-600 hover:underline font-medium">{GRIEVANCE_OFFICER.email}</a></div>
              <div><span className="text-gray-500 text-xs">Phone</span><p className="font-semibold">{GRIEVANCE_OFFICER.phone}</p></div>
              <div className="sm:col-span-2"><span className="text-gray-500 text-xs">Address</span><p className="font-medium">{GRIEVANCE_OFFICER.address}</p></div>
            </div>
            <Link
              href="/contact/grievance-officer"
              className="mt-4 inline-block bg-amber-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-amber-700 font-medium"
            >
              File a Grievance →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
