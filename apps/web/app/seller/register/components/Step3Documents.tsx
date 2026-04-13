/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { saveKycDraft, loadKycDraft } from '@/stores/kycStore';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
const IEC_REGEX = /^[A-Z0-9]{10}$/;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const step3Schema = z.object({
  gstNumber: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)').transform(s => s.toUpperCase()),
  gstCertificateUrl: z.string().min(1, 'Please upload GST Certificate'),
  panNumber: z.string().regex(PAN_REGEX, 'Invalid PAN format (e.g. ABCDE1234F)').transform(s => s.toUpperCase()),
  panCardUrl: z.string().min(1, 'Please upload PAN Card'),
  iecCode: z.string().regex(IEC_REGEX, 'IEC must be 10 alphanumeric characters').optional().or(z.literal('')),
  iecCertificateUrl: z.string().optional(),
  udyamNumber: z.string().regex(UDYAM_REGEX, 'Format: UDYAM-XX-00-0000000').optional().or(z.literal('')),
  udyamCertificateUrl: z.string().optional(),
});

type Step3Form = z.infer<typeof step3Schema>;

interface GstinVerification {
  loading: boolean;
  valid?: boolean;
  legalName?: string;
  error?: string;
}

interface UploadState {
  uploading: boolean;
  url?: string;
  name?: string;
  error?: string;
}

interface Props {
  hasIEC: boolean;
  onNext: (data: Step3Form) => void;
  onBack: () => void;
}

function FileUploadField({
  label,
  required,
  onUploaded,
  existingUrl,
}: {
  label: string;
  required?: boolean;
  onUploaded: (url: string, name: string) => void;
  existingUrl?: string;
}) {
  const [state, setState] = useState<UploadState>({ uploading: false, url: existingUrl });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setState({ uploading: false, error: 'File exceeds 5 MB limit' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setState({ uploading: false, error: 'Only PDF, JPG, PNG allowed' });
      return;
    }

    setState({ uploading: true, error: undefined });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await axios.post(`${API_URL}/api/upload/kyc-document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = res.data?.data;
      setState({ uploading: false, url: data.fileUrl, name: file.name });
      onUploaded(data.fileUrl, file.name);
    } catch (err: any) {
      setState({ uploading: false, error: err?.response?.data?.message ?? 'Upload failed' });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
        <span className="text-gray-400 font-normal ml-1">(PDF/JPG/PNG, max 5 MB)</span>
      </label>

      {state.url ? (
        <div className="flex items-center gap-3 p-3 border border-green-300 bg-green-50 rounded-lg">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-green-700 flex-1 truncate">{state.name ?? 'Uploaded'}</span>
          <button
            type="button"
            onClick={() => {
              setState({ uploading: false });
              onUploaded('', '');
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          {state.uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Uploading…</span>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600">Drag & drop or <span className="text-blue-600">browse</span></p>
            </>
          )}
        </div>
      )}

      {state.error && <p className="text-red-600 text-xs mt-1">{state.error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

export default function Step3Documents({ hasIEC, onNext, onBack }: Props) {
  const draft = loadKycDraft();
  const [gstinVerification, setGstinVerification] = useState<GstinVerification>({ loading: false });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: draft.step3 ?? { gstNumber: '', gstCertificateUrl: '', panNumber: '', panCardUrl: '' },
  });

  watch('gstNumber');

  // Real-time GSTIN verification on blur
  const verifyGstin = async (value: string) => {
    const normalized = value.toUpperCase().trim();
    if (!GSTIN_REGEX.test(normalized)) return;

    setGstinVerification({ loading: true });
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await axios.post(
        `${API_URL}/api/verify/gstin`,
        { gstin: normalized },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = res.data?.data;
      if (data?.valid) {
        setGstinVerification({ loading: false, valid: true, legalName: data.legalName });
      } else {
        setGstinVerification({ loading: false, valid: false, error: data?.error ?? 'GSTIN not found' });
      }
    } catch {
      setGstinVerification({ loading: false, valid: false, error: 'Verification unavailable' });
    }
  };

  const onSubmit = (data: Step3Form) => {
    saveKycDraft({ step3: data, currentStep: 4 });
    onNext(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* GSTIN */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GSTIN <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(15 characters)</span>
        </label>
        <div className="relative">
          <input
            {...register('gstNumber')}
            type="text"
            placeholder="27AAPFU0939F1ZV"
            maxLength={15}
            onBlur={(e) => verifyGstin(e.target.value)}
            onChange={(e) => {
              register('gstNumber').onChange(e);
              setGstinVerification({ loading: false });
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {gstinVerification.loading && (
              <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {!gstinVerification.loading && gstinVerification.valid === true && (
              <span className="text-green-600 text-lg">✓</span>
            )}
            {!gstinVerification.loading && gstinVerification.valid === false && (
              <span className="text-red-600 text-lg">✗</span>
            )}
          </div>
        </div>
        {errors.gstNumber && <p className="text-red-600 text-xs mt-1">{errors.gstNumber.message}</p>}
        {gstinVerification.valid === true && gstinVerification.legalName && (
          <p className="text-green-600 text-xs mt-1">✓ {gstinVerification.legalName}</p>
        )}
        {gstinVerification.valid === false && gstinVerification.error && (
          <p className="text-red-600 text-xs mt-1">{gstinVerification.error}</p>
        )}
      </div>

      <FileUploadField
        label="GST Certificate"
        required
        existingUrl={draft.step3?.gstCertificateUrl}
        onUploaded={(url) => setValue('gstCertificateUrl', url, { shouldValidate: true })}
      />
      {errors.gstCertificateUrl && <p className="text-red-600 text-xs -mt-4">{errors.gstCertificateUrl.message}</p>}

      {/* PAN */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          PAN Number <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(10 characters, e.g. ABCDE1234F)</span>
        </label>
        <input
          {...register('panNumber')}
          type="text"
          placeholder="ABCDE1234F"
          maxLength={10}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
        />
        {errors.panNumber && <p className="text-red-600 text-xs mt-1">{errors.panNumber.message}</p>}
      </div>

      <FileUploadField
        label="PAN Card"
        required
        existingUrl={draft.step3?.panCardUrl}
        onUploaded={(url) => setValue('panCardUrl', url, { shouldValidate: true })}
      />
      {errors.panCardUrl && <p className="text-red-600 text-xs -mt-4">{errors.panCardUrl.message}</p>}

      {/* IEC (conditional) */}
      {hasIEC && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IEC Code <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(10 alphanumeric, DGFT)</span>
            </label>
            <input
              {...register('iecCode')}
              type="text"
              placeholder="AB1234567C"
              maxLength={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
            {errors.iecCode && <p className="text-red-600 text-xs mt-1">{errors.iecCode.message}</p>}
          </div>

          <FileUploadField
            label="IEC Certificate"
            required
            existingUrl={draft.step3?.iecCertificateUrl}
            onUploaded={(url) => setValue('iecCertificateUrl', url)}
          />
        </>
      )}

      {/* Udyam / MSME (optional) */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">MSME / Udyam Registration <span className="text-gray-400 font-normal">(optional)</span></p>
        <div>
          <input
            {...register('udyamNumber')}
            type="text"
            placeholder="UDYAM-MH-12-0001234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.udyamNumber && <p className="text-red-600 text-xs mt-1">{errors.udyamNumber.message}</p>}
        </div>
        <FileUploadField
          label="Udyam Certificate"
          existingUrl={draft.step3?.udyamCertificateUrl}
          onUploaded={(url) => setValue('udyamCertificateUrl', url)}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium hover:bg-gray-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          Continue to Personal Details →
        </button>
      </div>
    </form>
  );
}
