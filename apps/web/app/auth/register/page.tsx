/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const registerSchema = z
  .object({
    role: z.enum(['BUYER', 'SELLER']),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    phoneNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
      .optional()
      .or(z.literal('')),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
});

type RegisterForm = z.infer<typeof registerSchema>;
type OtpForm = z.infer<typeof otpSchema>;

type Step = 'role' | 'register' | 'otp' | 'done';

function RegisterContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<'BUYER' | 'SELLER' | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string>('');

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'BUYER' },
  });

  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  const handleRoleSelect = (role: 'BUYER' | 'SELLER') => {
    setSelectedRole(role);
    registerForm.setValue('role', role);
    setStep('register');
  };

  const onRegister = async (data: RegisterForm) => {
    setServerError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, {
        email: data.email,
        password: data.password,
        phoneNumber: data.phoneNumber || undefined,
        role: data.role,
      });

      const result = res.data?.data;

      if (result?.userId) {
        // OTP flow — phone was provided
        setUserId(result.userId);
        setMaskedPhone(result.message?.match(/\d+\*+\d+/)?.[0] ?? data.phoneNumber ?? '');
        setStep('otp');
      } else {
        // No phone — tokens issued directly
        const token = result?.accessToken;
        if (token) localStorage.setItem('accessToken', token);
        if (data.role === 'SELLER') {
          router.push('/seller/register');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Registration failed. Please try again.');
    }
  };

  const onVerifyOtp = async (data: OtpForm) => {
    setServerError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/verify-otp`, {
        userId,
        otp: data.otp,
      });

      const result = res.data?.data;
      if (result?.accessToken) {
        localStorage.setItem('accessToken', result.accessToken);
        if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);
        setStep('done');
        setTimeout(() => {
          if (selectedRole === 'SELLER') {
            router.push('/seller/register');
          } else {
            router.push('/');
          }
        }, 1500);
      }
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Progress breadcrumb */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
          <span className={step === 'role' ? 'text-blue-600 font-medium' : 'text-gray-400'}>
            Select Role
          </span>
          <span>→</span>
          <span className={step === 'register' ? 'text-blue-600 font-medium' : 'text-gray-400'}>
            Register
          </span>
          <span>→</span>
          <span className={step === 'otp' ? 'text-blue-600 font-medium' : 'text-gray-400'}>
            Verify OTP
          </span>
          {selectedRole === 'SELLER' && (
            <>
              <span>→</span>
              <span className="text-gray-400">Complete KYC</span>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* ─── STEP: Role Selection ─── */}
          {step === 'role' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Join B2B Bazaar</h1>
              <p className="text-gray-500 mb-8">How would you like to use the platform?</p>
              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => handleRoleSelect('SELLER')}
                  className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">I want to Sell</p>
                    <p className="text-sm text-gray-500">List products, get bulk orders, grow your business</p>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelect('BUYER')}
                  className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">I want to Buy</p>
                    <p className="text-sm text-gray-500">Source products, compare prices, place bulk orders</p>
                  </div>
                </button>
              </div>
              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {/* ─── STEP: Register Form ─── */}
          {step === 'register' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep('role')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
                  <p className="text-sm text-gray-500">
                    Registering as a{' '}
                    <span className="font-medium text-blue-600 capitalize">
                      {selectedRole?.toLowerCase()}
                    </span>
                  </p>
                </div>
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                  {serverError}
                </div>
              )}

              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    {...registerForm.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-red-600 text-xs mt-1">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-gray-400">(for OTP verification)</span>
                  </label>
                  <div className="flex">
                    <span className="flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-500 text-sm">
                      +91
                    </span>
                    <input
                      {...registerForm.register('phoneNumber')}
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {registerForm.formState.errors.phoneNumber && (
                    <p className="text-red-600 text-xs mt-1">{registerForm.formState.errors.phoneNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    {...registerForm.register('password')}
                    type="password"
                    placeholder="At least 8 characters"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-red-600 text-xs mt-1">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    {...registerForm.register('confirmPassword')}
                    type="password"
                    placeholder="Repeat your password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-red-600 text-xs mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={registerForm.formState.isSubmitting}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {registerForm.formState.isSubmitting ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {/* ─── STEP: OTP Verification ─── */}
          {step === 'otp' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Number</h1>
              <p className="text-gray-500 mb-6">
                Enter the 6-digit OTP sent to <span className="font-medium text-gray-700">{maskedPhone}</span>
              </p>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                  {serverError}
                </div>
              )}

              <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OTP</label>
                  <input
                    {...otpForm.register('otp')}
                    type="text"
                    inputMode="numeric"
                    placeholder="••••••"
                    maxLength={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-2xl text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {otpForm.formState.errors.otp && (
                    <p className="text-red-600 text-xs mt-1">{otpForm.formState.errors.otp.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={otpForm.formState.isSubmitting}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {otpForm.formState.isSubmitting ? 'Verifying…' : 'Verify OTP'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-4">
                OTP valid for 5 minutes. Didn&apos;t receive it?{' '}
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => setStep('register')}
                >
                  Go back
                </button>
              </p>
            </>
          )}

          {/* ─── STEP: Done ─── */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Account Verified!</h2>
              <p className="text-gray-500">
                {selectedRole === 'SELLER'
                  ? 'Redirecting to KYC registration…'
                  : 'Redirecting to homepage…'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const S = Suspense as any; // @types/react version compat shim
  return (
    <S fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <RegisterContent />
    </S>
  );
}
