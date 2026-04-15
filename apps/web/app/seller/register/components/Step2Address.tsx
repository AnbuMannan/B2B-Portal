'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { saveKycDraft, loadKycDraft } from '@/stores/kycStore';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands',
  'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

const addressSchema = z.object({
  addressLine1: z.string().min(5, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'Please select a state'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});

const step2Schema = z.object({
  registeredOfficeAddress: addressSchema,
  sameAsRegistered: z.boolean(),
  businessOfficeAddress: addressSchema.optional(),
});

type Step2Form = z.infer<typeof step2Schema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Props {
  onNext: (data: Step2Form) => void;
  onBack: () => void;
}

interface PincodeInfo {
  city: string;
  state: string;
  district?: string;
}

export default function Step2Address({ onNext, onBack }: Props) {
  const draft = loadKycDraft();
  const [sameAsRegistered, setSameAsRegistered] = useState(draft.step2?.sameAsRegistered ?? true);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeInfo, setPincodeInfo] = useState<PincodeInfo | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      registeredOfficeAddress: draft.step2?.registeredOfficeAddress ?? {
        addressLine1: '', city: '', state: '', pincode: '',
      },
      sameAsRegistered: draft.step2?.sameAsRegistered ?? true,
      businessOfficeAddress: draft.step2?.businessOfficeAddress,
    },
  });

  const pincode = watch('registeredOfficeAddress.pincode');

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) return;

    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      setPincodeInfo(null);
      try {
        const res = await axios.get(`${API_URL}/api/verify/pincode/${pincode}`);
        const data = res.data?.data;
        if (data?.valid) {
          setValue('registeredOfficeAddress.city', data.city ?? '', { shouldValidate: true });
          setValue('registeredOfficeAddress.state', data.state ?? '', { shouldValidate: true });
          setPincodeInfo({ city: data.city, state: data.state, district: data.district });
        }
      } catch {
        // silently fail — user can enter manually
      } finally {
        setPincodeLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [pincode, setValue]);

  const onSubmit = (data: Step2Form) => {
    const finalData = {
      ...data,
      businessOfficeAddress: sameAsRegistered ? data.registeredOfficeAddress : data.businessOfficeAddress,
      sameAsRegistered,
    };
    saveKycDraft({ step2: finalData as any, currentStep: 3 });
    onNext(finalData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h3 className="text-base font-semibold text-gray-800">Registered Office Address</h3>

      {/* Address Line 1 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 1 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('registeredOfficeAddress.addressLine1')}
          placeholder="House/Flat No., Street Name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.registeredOfficeAddress?.addressLine1 && (
          <p className="text-red-600 text-xs mt-1">{errors.registeredOfficeAddress.addressLine1.message}</p>
        )}
      </div>

      {/* Address Line 2 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 2 <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          {...register('registeredOfficeAddress.addressLine2')}
          placeholder="Landmark, Area"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Pincode + auto-fill */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pincode <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('registeredOfficeAddress.pincode')}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="400001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pincodeLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
          {errors.registeredOfficeAddress?.pincode && (
            <p className="text-red-600 text-xs mt-1">{errors.registeredOfficeAddress.pincode.message}</p>
          )}
          {pincodeInfo && (
            <p className="text-green-600 text-xs mt-1">
              ✓ {pincodeInfo.district ?? pincodeInfo.city}, {pincodeInfo.state}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            {...register('registeredOfficeAddress.city')}
            placeholder="Mumbai"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.registeredOfficeAddress?.city && (
            <p className="text-red-600 text-xs mt-1">{errors.registeredOfficeAddress.city.message}</p>
          )}
        </div>
      </div>

      {/* State */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          State <span className="text-red-500">*</span>
        </label>
        <select
          {...register('registeredOfficeAddress.state')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Select state</option>
          {INDIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {errors.registeredOfficeAddress?.state && (
          <p className="text-red-600 text-xs mt-1">{errors.registeredOfficeAddress.state.message}</p>
        )}
      </div>

      {/* Same as registered toggle */}
      <div className="border-t pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sameAsRegistered}
            onChange={(e) => {
              setSameAsRegistered(e.target.checked);
              setValue('sameAsRegistered', e.target.checked);
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            Business office address is same as registered office address
          </span>
        </label>
      </div>

      {/* Business office address (conditional) */}
      {!sameAsRegistered && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">Business Office Address</h4>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
            <input
              {...register('businessOfficeAddress.addressLine1')}
              placeholder="House/Flat No., Street Name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                {...register('businessOfficeAddress.pincode')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="400001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                {...register('businessOfficeAddress.city')}
                placeholder="Mumbai"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              {...register('businessOfficeAddress.state')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
      )}

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
          Continue to Documents →
        </button>
      </div>
    </form>
  );
}
