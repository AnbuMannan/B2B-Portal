'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------
const enquirySchema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  unit: z.string().min(1, 'Please select a unit'),
  targetPriceMin: z
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0)
    .optional()
    .or(z.literal(undefined)),
  targetPriceMax: z
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0)
    .optional()
    .or(z.literal(undefined)),
  contactChannel: z.enum(['WHATSAPP', 'TELEGRAM', 'EMAIL']),
});

type EnquiryForm = z.infer<typeof enquirySchema>;

interface Props {
  productId: string;
  productName: string;
}

const UNITS = ['pieces', 'kg', 'litre', 'metre', 'ton', 'box', 'bundle', 'pack', 'set'];

const CONTACT_OPTIONS: { value: 'WHATSAPP' | 'TELEGRAM' | 'EMAIL'; label: string; icon: string }[] =
  [
    { value: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
    { value: 'EMAIL', label: 'Email', icon: '✉️' },
    { value: 'TELEGRAM', label: 'Telegram', icon: '📨' },
  ];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EnquiryModal({ productId, productName }: Props) {
  const { data: session } = useSession();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryForm>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { unit: 'pieces', contactChannel: 'WHATSAPP' },
  });

  const selectedChannel = watch('contactChannel');

  const handleOpen = () => {
    const token = session?.accessToken ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    if (!token) {
      router.push(`/auth/signin?returnUrl=/product/${productId}`);
      return;
    }
    router.push('/buyer/requirements/new');
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsSuccess(false);
    setServerError(null);
    reset();
  };

  const onSubmit = async (data: EnquiryForm) => {
    setServerError(null);

    try {
      const res = await fetch(`/api/products/${productId}/enquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken ?? ''}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setServerError(json.error?.message ?? 'Failed to submit enquiry. Please try again.');
        return;
      }

      setIsSuccess(true);
      reset();
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <>
      {/* CTA buttons */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <button
          onClick={handleOpen}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          💼 Get Best Quote
        </button>
        <a
          href="/buyer/requirements/new"
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-semibold text-blue-700 border border-blue-600 hover:bg-blue-50 transition-colors"
        >
          📋 Post Buy Requirement
        </a>
        <p className="text-xs text-center text-gray-400">
          🔒 Your contact details are never shared publicly
        </p>
      </div>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enquiry-modal-title"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 id="enquiry-modal-title" className="text-base font-semibold text-gray-900">
                Get Best Quote
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {isSuccess ? (
                // ── Success state ──
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Enquiry Sent!</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Verified sellers will contact you via your preferred channel within 24 hours.
                  </p>
                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                // ── Enquiry form ──
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  {/* Product name (read-only) */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Product</p>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{productName}</p>
                  </div>

                  {serverError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {serverError}
                    </div>
                  )}

                  {/* Quantity + Unit */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        {...register('quantity', { valueAsNumber: true })}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g. 100"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        {...register('unit')}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Target price range */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Target Price Range (₹){' '}
                      <span className="text-gray-400 font-normal">— optional</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={0}
                        {...register('targetPriceMin', { valueAsNumber: true })}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        min={0}
                        {...register('targetPriceMax', { valueAsNumber: true })}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  {/* Contact preference */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Preferred Contact Channel <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CONTACT_OPTIONS.map(({ value, label, icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setValue('contactChannel', value)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                            selectedChannel === value
                              ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-lg mb-0.5">{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                    {errors.contactChannel && (
                      <p className="mt-1 text-xs text-red-600">{errors.contactChannel.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      'Send Enquiry'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
