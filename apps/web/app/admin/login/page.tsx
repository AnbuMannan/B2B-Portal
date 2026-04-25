'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin',  color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ADMIN:       { label: 'Admin',        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  REVIEWER:    { label: 'Reviewer',     color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  FINANCE:     { label: 'Finance',      color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  SUPPORT:     { label: 'Support',      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * 2FA step — DISABLED in dev, enable for ADMIN + SUPER_ADMIN before production.
   *
   * const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
   * const [totpCode, setTotpCode] = useState('');
   * const [pendingToken, setPendingToken] = useState<string | null>(null);
   */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/admin/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
        /*
         * totpCode,  // uncomment when 2FA is enabled
         */
      });

      const { accessToken, expiresIn, admin } = res.data.data;

      localStorage.setItem('adminAccessToken', accessToken);
      localStorage.setItem('adminRole', admin.adminRole);
      localStorage.setItem('adminEmail', admin.email);
      // Session expires at: store for client-side session checks
      localStorage.setItem(
        'adminSessionExpiry',
        String(Date.now() + expiresIn * 1000),
      );

      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setError('Too many login attempts. Please wait 15 minutes.');
      } else {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? 'Invalid credentials');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">B2B Portal Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Restricted access — authorised personnel only</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Admin email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@b2bportal.in"
              required
              autoComplete="username"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/*
           * 2FA TOTP input — DISABLED, enable for ADMIN + SUPER_ADMIN before production.
           *
           * {step === 'totp' && (
           *   <div>
           *     <label className="block text-sm font-medium text-slate-300 mb-1.5">
           *       Authenticator code
           *     </label>
           *     <input
           *       type="text"
           *       inputMode="numeric"
           *       pattern="[0-9]{6}"
           *       maxLength={6}
           *       value={totpCode}
           *       onChange={(e) => setTotpCode(e.target.value)}
           *       placeholder="000000"
           *       className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white text-center text-xl tracking-widest rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
           *     />
           *   </div>
           * )}
           */}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Signing in…' : 'Sign in to Admin Panel'}
          </button>
        </form>

        {/* Role badges — purely informational, shows what roles exist */}
        <div className="mt-6">
          <p className="text-xs text-slate-600 text-center mb-3">Admin roles</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(ROLE_BADGE).map(([, cfg]) => (
              <span
                key={cfg.label}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color}`}
              >
                {cfg.label}
              </span>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Session expires after 4 hours. All actions are audited.
        </p>
      </div>
    </div>
  );
}
