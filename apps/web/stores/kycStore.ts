'use client';

/**
 * KYC form state persisted to sessionStorage.
 * Survives page refresh within the same browser session.
 * No external state library required — custom hook pattern.
 */

const SESSION_KEY = 'b2b_kyc_draft';

export interface KycDraftState {
  sellerId?: string;
  currentStep: 1 | 2 | 3 | 4;
  step1?: {
    companyName: string;
    companyType: string;
    industryType: string[];
    businessModel: string;
    hasIEC: boolean;
  };
  step2?: {
    registeredOfficeAddress: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    sameAsRegistered: boolean;
    businessOfficeAddress?: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  step3?: {
    gstNumber: string;
    gstCertificateUrl: string;
    panNumber: string;
    panCardUrl: string;
    iecCode?: string;
    iecCertificateUrl?: string;
    udyamNumber?: string;
    udyamCertificateUrl?: string;
  };
  step4?: {
    fullName: string;
    designation: string;
    photoUrl?: string;
    directorPan?: string;
    aadhaarLastFour: string;
  };
}

export function loadKycDraft(): KycDraftState {
  if (typeof window === 'undefined') return { currentStep: 1 };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as KycDraftState) : { currentStep: 1 };
  } catch {
    return { currentStep: 1 };
  }
}

export function saveKycDraft(state: Partial<KycDraftState>): void {
  if (typeof window === 'undefined') return;
  const current = loadKycDraft();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...state }));
}

export function clearKycDraft(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}
