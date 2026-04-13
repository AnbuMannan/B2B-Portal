/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { saveKycDraft, loadKycDraft } from '@/stores/kycStore';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const step4Schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  designation: z.string().min(2, 'Designation is required'),
  photoUrl: z.string().optional(),
  directorPan: z
    .string()
    .regex(PAN_REGEX, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  aadhaarLastFour: z
    .string()
    .length(4, 'Enter exactly 4 digits (UIDAI guidelines)')
    .regex(/^\d{4}$/, 'Must be 4 numeric digits'),
});

type Step4Form = z.infer<typeof step4Schema>;

interface Props {
  onNext: (data: Step4Form) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export default function Step4PersonalDetails({ onNext, onBack, isSubmitting: parentSubmitting }: Props) {
  const draft = loadKycDraft();
  const [photoUrl, setPhotoUrl] = useState(draft.step4?.photoUrl ?? '');
  const [photoName, setPhotoName] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Aadhaar input: only allow 4 digit entry, visually shows XXXX XXXX XXXX mask
  const [aadhaarInput, setAadhaarInput] = useState(draft.step4?.aadhaarLastFour ?? '');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Step4Form>({
    resolver: zodResolver(step4Schema),
    defaultValues: draft.step4 ?? {
      fullName: '',
      designation: '',
      aadhaarLastFour: '',
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo must be under 5 MB');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Only JPG or PNG allowed');
      return;
    }

    setPhotoUploading(true);
    setPhotoError('');
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
      setPhotoUrl(data.fileUrl);
      setPhotoName(file.name);
      setValue('photoUrl', data.fileUrl);
    } catch (err: any) {
      setPhotoError(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  const onSubmit = (data: Step4Form) => {
    const finalData = {
      ...data,
      photoUrl: photoUrl || undefined,
      // empty string must become undefined so backend @IsOptional() skips the PAN regex
      directorPan: data.directorPan?.trim() || undefined,
    };
    saveKycDraft({ step4: finalData, currentStep: 4 });
    onNext(finalData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        Details of the Proprietor / Managing Director / Authorized Signatory
      </p>

      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register('fullName')}
          type="text"
          placeholder="As on government ID"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.fullName && <p className="text-red-600 text-xs mt-1">{errors.fullName.message}</p>}
      </div>

      {/* Designation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Designation <span className="text-red-500">*</span>
        </label>
        <input
          {...register('designation')}
          type="text"
          placeholder="e.g. Managing Director, Proprietor"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.designation && <p className="text-red-600 text-xs mt-1">{errors.designation.message}</p>}
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Photo <span className="text-gray-400 font-normal">(optional, JPG/PNG, max 5 MB)</span>
        </label>
        {photoUrl ? (
          <div className="flex items-center gap-3 p-3 border border-green-300 bg-green-50 rounded-lg">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-700 flex-1 truncate">{photoName || 'Photo uploaded'}</span>
            <button
              type="button"
              onClick={() => { setPhotoUrl(''); setValue('photoUrl', ''); }}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoUploading}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            {photoUploading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : (
              'Upload Photo'
            )}
          </button>
        )}
        {photoError && <p className="text-red-600 text-xs mt-1">{photoError}</p>}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(file);
          }}
        />
      </div>

      {/* Director PAN */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Director PAN <span className="text-gray-400 font-normal">(optional — if different from company PAN)</span>
        </label>
        <input
          {...register('directorPan')}
          type="text"
          placeholder="ABCDE1234F"
          maxLength={10}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
        />
        {errors.directorPan && <p className="text-red-600 text-xs mt-1">{errors.directorPan.message}</p>}
      </div>

      {/* Aadhaar last 4 digits — UIDAI compliant */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Aadhaar (last 4 digits) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          {/* Visual mask showing XXXX XXXX ____ */}
          <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
            <span className="text-sm text-gray-400 font-mono tracking-widest select-none">
              XXXX XXXX{' '}
              <span className="text-gray-900">
                {aadhaarInput.padEnd(4, '_')}
              </span>
            </span>
          </div>
          <input
            {...register('aadhaarLastFour')}
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={aadhaarInput}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setAadhaarInput(val);
              setValue('aadhaarLastFour', val, { shouldValidate: true });
            }}
            placeholder=""
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 opacity-0"
            style={{ caretColor: 'transparent' }}
          />
        </div>
        <p className="text-gray-400 text-xs mt-1">
          Per UIDAI guidelines, only the last 4 digits are stored. Full Aadhaar number is never collected.
        </p>
        {errors.aadhaarLastFour && (
          <p className="text-red-600 text-xs mt-1">{errors.aadhaarLastFour.message}</p>
        )}
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
          disabled={isSubmitting || parentSubmitting}
          className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {isSubmitting || parentSubmitting ? 'Submitting…' : 'Submit KYC Application'}
        </button>
      </div>
    </form>
  );
}
