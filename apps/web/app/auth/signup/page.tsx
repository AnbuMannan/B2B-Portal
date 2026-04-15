'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const signUpSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    phoneNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
      .optional()
      .or(z.literal('')),
    role: z.enum(['BUYER', 'SELLER']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

// ─── OTP Modal ────────────────────────────────────────────────────────────────

interface OtpModalProps {
  userId: string;
  role: 'BUYER' | 'SELLER';
  onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void;
  onError: (msg: string) => void;
}

function OtpModal({ userId, role, onSuccess, onError }: OtpModalProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        onError(json.message ?? 'Invalid or expired OTP');
        return;
      }
      onSuccess({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
    } catch {
      onError('OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Verify your mobile</h3>
          <p className="text-sm text-gray-500 mt-1">Enter the 6-digit OTP sent to your phone</p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full text-center text-2xl font-mono tracking-[0.5em] border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
        />

        <button
          onClick={handleVerify}
          disabled={otp.length !== 6 || loading}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying…' : 'Verify OTP'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          {role === 'SELLER'
            ? "After verification you'll complete your business KYC"
            : "After verification you'll be taken to your account"}
        </p>
      </div>
    </div>
  );
}

// ─── Main signup page ─────────────────────────────────────────────────────────

function SignUpContent() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') ?? '/';

  const [serverError, setServerError] = useState<string | null>(null);
  const [otpState, setOtpState] = useState<{ userId: string; role: 'BUYER' | 'SELLER' } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: 'BUYER' },
  });

  const selectedRole = watch('role');

  /** Store tokens in localStorage and hard-navigate based on role */
  const finishAuth = (
    tokens: { accessToken: string; refreshToken: string },
    role: 'BUYER' | 'SELLER',
  ) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    const dest = role === 'SELLER'
      ? '/seller/register'
      : (returnUrl && returnUrl !== '/' ? returnUrl : '/');
    window.location.href = dest;
  };

  const onSubmit = async (data: SignUpForm) => {
    setServerError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          phoneNumber: data.phoneNumber || undefined,
          role: data.role,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setServerError(json.message ?? 'Registration failed. Please try again.');
        return;
      }

      const payload = json.data;

      // Phone provided → OTP required before tokens are issued
      if (payload?.userId && !payload?.accessToken) {
        setOtpState({ userId: payload.userId, role: data.role });
        return;
      }

      // No phone → tokens issued immediately
      if (payload?.accessToken) {
        finishAuth({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, data.role);
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <>
      {otpState && (
        <OtpModal
          userId={otpState.userId}
          role={otpState.role}
          onSuccess={(tokens) => finishAuth(tokens, otpState.role)}
          onError={(msg) => {
            setServerError(msg);
            setOtpState(null);
          }}
        />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex justify-center">
            <span className="text-2xl font-bold text-blue-600">B2B Portal</span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already registered?{' '}
            <Link
              href={`/auth/signin${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-100">
            {serverError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">I want to</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['BUYER', 'SELLER'] as const).map((role) => (
                    <label
                      key={role}
                      className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                        selectedRole === role
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        value={role}
                        {...register('role')}
                        className="sr-only"
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {role === 'BUYER' ? '🛒 Buy' : '🏭 Sell'}
                        </span>
                        <span className="mt-1 text-xs text-gray-500">
                          {role === 'BUYER' ? 'Post requirements & get quotes' : 'List products & find buyers'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile number{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    +91
                  </span>
                  <input
                    id="phoneNumber"
                    type="tel"
                    {...register('phoneNumber')}
                    className="block w-full rounded-r-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="9876543210"
                    maxLength={10}
                  />
                </div>
                {errors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-600">{errors.phoneNumber.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Min. 8 characters"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  'Create account — Free'
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              Free to register. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SignUpPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S = Suspense as any; // @types/react version compat shim
  return (
    <S>
      <SignUpContent />
    </S>
  );
}
