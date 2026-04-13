/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { loadKycDraft, saveKycDraft, clearKycDraft } from '@/stores/kycStore';
import Step1BusinessProfile from './components/Step1BusinessProfile';
import Step2Address from './components/Step2Address';
import Step3Documents from './components/Step3Documents';
import Step4PersonalDetails from './components/Step4PersonalDetails';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const STEPS = [
  { label: 'Business Profile', description: 'Company details' },
  { label: 'Address', description: 'Office location' },
  { label: 'Documents', description: 'GST, PAN, IEC' },
  { label: 'Personal Details', description: 'Director / Proprietor' },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-400 hidden sm:block">{step.description}</p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 -mt-6 transition-colors ${
                  stepNum < currentStep ? 'bg-green-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SellerRegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [step1Data, setStep1Data] = useState<any>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const extractError = (err: any, fallback: string): string => {
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (typeof msg === 'string') return msg;
    return fallback;
  };

  // On mount: fetch existing KYC data from API and hydrate the draft store
  useEffect(() => {
    const hydrate = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) { setHydrating(false); return; }

      try {
        const res = await axios.get(`${API_URL}/api/seller/kyc/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const seller = res.data?.data;

        if (!seller || seller.kycStatus === 'NOT_STARTED') {
          // Fall back to draft in sessionStorage
          const draft = loadKycDraft();
          setCurrentStep((draft.currentStep as 1 | 2 | 3 | 4) ?? 1);
          setStep1Data(draft.step1 ?? null);
          setHydrating(false);
          return;
        }

        // Build step data from the API response
        const docMap: Record<string, string> = {};
        (seller.kycDocuments ?? []).forEach((d: any) => {
          docMap[d.documentType] = d.fileUrl;
        });

        const step1 = seller.companyName && seller.companyName !== 'Pending' ? {
          companyName: seller.companyName,
          companyType: seller.companyType,
          industryType: seller.industryType ?? [],
          businessModel: seller.businessModel,
          hasIEC: seller.hasIEC ?? false,
        } : null;

        let step2 = null;
        if (seller.registeredOfficeAddress) {
          try {
            const reg = JSON.parse(seller.registeredOfficeAddress);
            const biz = seller.businessOfficeAddress ? JSON.parse(seller.businessOfficeAddress) : null;
            const sameAsRegistered =
              !biz ||
              (reg.addressLine1 === biz.addressLine1 &&
                reg.city === biz.city &&
                reg.pincode === biz.pincode);
            step2 = {
              registeredOfficeAddress: reg,
              sameAsRegistered,
              businessOfficeAddress: sameAsRegistered ? undefined : biz,
            };
          } catch {}
        }

        const step3 = seller.gstNumber ? {
          gstNumber: seller.gstNumber,
          gstCertificateUrl: docMap['GST_CERTIFICATE'] ?? '',
          panNumber: seller.panNumber ?? '',
          panCardUrl: docMap['PAN_CARD'] ?? '',
          iecCode: seller.iecCode ?? undefined,
          iecCertificateUrl: docMap['IEC_CERTIFICATE'] ?? undefined,
          udyamNumber: seller.udyamNumber ?? undefined,
          udyamCertificateUrl: docMap['UDYAM'] ?? undefined,
        } : null;

        const step4 = seller.directorName ? {
          fullName: seller.directorName,
          designation: seller.directorDesignation ?? '',
          photoUrl: seller.directorPhoto ?? undefined,
          directorPan: seller.directorPan ?? undefined,
          aadhaarLastFour: seller.aadhaarLastFour ?? '',
        } : null;

        // Determine which step to land on: first incomplete step
        let landOn: 1 | 2 | 3 | 4 = 1;
        if (step1) landOn = 2;
        if (step2) landOn = 3;
        if (step3) landOn = 4;
        // If all 4 steps are done, stay on step 1 so seller can review from beginning
        if (step1 && step2 && step3 && step4) landOn = 1;

        // Persist to draft so each step component's defaultValues pick it up
        saveKycDraft({
          currentStep: landOn,
          ...(step1 ? { step1 } : {}),
          ...(step2 ? { step2 } : {}),
          ...(step3 ? { step3 } : {}),
          ...(step4 ? { step4 } : {}),
        });

        setStep1Data(step1);
        setCurrentStep(landOn);
      } catch {
        // API error — fall back to draft
        const draft = loadKycDraft();
        setCurrentStep((draft.currentStep as 1 | 2 | 3 | 4) ?? 1);
        setStep1Data(draft.step1 ?? null);
      } finally {
        setHydrating(false);
      }
    };

    hydrate();
  }, []);

  const handleStep1 = async (data: any) => {
    setServerError(null);
    try {
      await axios.post(`${API_URL}/api/seller/kyc/step-1`, data, { headers: authHeaders() });
      setStep1Data(data);
      setCurrentStep(2);
    } catch (err: any) {
      setServerError(extractError(err, 'Failed to save business profile'));
    }
  };

  const handleStep2 = async (data: any) => {
    setServerError(null);
    try {
      await axios.post(`${API_URL}/api/seller/kyc/step-2`, data, { headers: authHeaders() });
      setCurrentStep(3);
    } catch (err: any) {
      setServerError(extractError(err, 'Failed to save address'));
    }
  };

  const handleStep3 = async (data: any) => {
    setServerError(null);
    try {
      await axios.post(`${API_URL}/api/seller/kyc/step-3`, data, { headers: authHeaders() });
      setCurrentStep(4);
    } catch (err: any) {
      setServerError(extractError(err, 'Failed to save documents'));
    }
  };

  const handleStep4 = async (data: any) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/seller/kyc/step-4`, data, { headers: authHeaders() });
      await axios.post(`${API_URL}/api/seller/kyc/submit`, {}, { headers: authHeaders() });
      clearKycDraft();
      router.push('/seller/kyc-submitted');
    } catch (err: any) {
      setServerError(extractError(err, 'Submission failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (hydrating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white text-xs font-bold">B2B</span>
                <span>Marketplace</span>
              </Link>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Seller Registration — KYC Verification</h1>
            <p className="text-sm text-gray-500">Complete all 4 steps to start selling on the platform</p>
          </div>
          <Link
            href="/seller/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
            {serverError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Step {currentStep}: {STEPS[currentStep - 1].label}
            </h2>
            <p className="text-sm text-gray-500">{STEPS[currentStep - 1].description}</p>
          </div>

          {currentStep === 1 && <Step1BusinessProfile onNext={handleStep1} />}
          {currentStep === 2 && (
            <Step2Address
              onNext={handleStep2}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <Step3Documents
              hasIEC={step1Data?.hasIEC ?? loadKycDraft().step1?.hasIEC ?? false}
              onNext={handleStep3}
              onBack={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && (
            <Step4PersonalDetails
              onNext={handleStep4}
              onBack={() => setCurrentStep(3)}
              isSubmitting={submitting}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your progress is automatically saved. You can return to complete registration later.
        </p>
      </div>
    </div>
  );
}
