/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import PricingTable from './PricingTable';
import ImageUploader from './ImageUploader';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const UNITS = ['PIECE', 'KG', 'LITRE', 'METRE', 'TON', 'BOX', 'BUNDLE', 'PACK'];
const COUNTRIES = ['India', 'China', 'USA', 'Germany', 'Japan', 'South Korea', 'Taiwan', 'Other'];
const PRESET_CERTIFICATIONS = [
  'ISO 9001',
  'ISO 14001',
  'FSSAI',
  'Drug Licence',
  'CE Mark',
  'BIS',
  'REACH',
  'RoHS',
];

const tierSchema = z.object({
  price: z.coerce.number().min(0, 'Price must be ≥ 0').optional(),
  moq: z.coerce.number().min(1, 'MOQ must be ≥ 1').optional(),
  enabled: z.boolean(),
});

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  hsnCode: z.string().optional(),
  unit: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  availabilityStatus: z.enum(['IN_STOCK', 'OUT_OF_STOCK']),
  categoryIds: z.array(z.string()),
  certifications: z.array(z.string()),
  multiTierPricing: z.object({
    retail: tierSchema.optional(),
    wholesale: tierSchema.optional(),
    bulk: tierSchema.optional(),
  }),
}).superRefine((data, ctx) => {
  const { retail, wholesale, bulk } = data.multiTierPricing;
  const hasEnabled = retail?.enabled || wholesale?.enabled || bulk?.enabled;
  if (!hasEnabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one pricing tier must be enabled',
      path: ['multiTierPricing'],
    });
  }
  // Validate enabled tiers have price and moq
  for (const [key, tier] of Object.entries(data.multiTierPricing)) {
    if (tier?.enabled) {
      if (!tier.price || tier.price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price is required for enabled tier',
          path: ['multiTierPricing', key, 'price'],
        });
      }
      if (!tier.moq || tier.moq < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MOQ is required for enabled tier',
          path: ['multiTierPricing', key, 'moq'],
        });
      }
    }
  }
});

type ProductFormData = z.infer<typeof productSchema>;

interface UploadedImage {
  fileUrl: string;
  thumbUrl: string;
  fileName: string;
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface ProductFormProps {
  /** Pre-fill values for edit mode */
  defaultValues?: Partial<ProductFormData> & { images?: UploadedImage[] };
  onSubmit: (data: ProductFormData & { images: UploadedImage[]; isDraft: boolean }) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export default function ProductForm({
  defaultValues,
  onSubmit,
  isSubmitting: parentSubmitting,
  submitLabel,
}: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<UploadedImage[]>(defaultValues?.images ?? []);
  const [customCert, setCustomCert] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      hsnCode: defaultValues?.hsnCode ?? '',
      unit: defaultValues?.unit ?? 'PIECE',
      countryOfOrigin: defaultValues?.countryOfOrigin ?? 'India',
      availabilityStatus: defaultValues?.availabilityStatus ?? 'IN_STOCK',
      categoryIds: defaultValues?.categoryIds ?? [],
      certifications: defaultValues?.certifications ?? [],
      multiTierPricing: defaultValues?.multiTierPricing ?? {
        retail: { price: undefined, moq: undefined, enabled: true },
        wholesale: { price: undefined, moq: undefined, enabled: false },
        bulk: { price: undefined, moq: undefined, enabled: false },
      },
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = methods;

  const selectedCategoryIds = watch('categoryIds');
  const selectedCertifications = watch('certifications');

  useEffect(() => {
    axios
      .get(`${API_URL}/api/seller/products/categories`, {
        headers: (() => {
          const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          return token ? { Authorization: `Bearer ${token}` } : {};
        })(),
      })
      .then((res) => setCategories(res.data.data ?? []))
      .catch(() => {});
  }, []);

  const toggleCategory = (id: string) => {
    const current = selectedCategoryIds ?? [];
    if (current.includes(id)) {
      setValue('categoryIds', current.filter((c) => c !== id));
    } else {
      setValue('categoryIds', [...current, id]);
    }
  };

  const toggleCertification = (cert: string) => {
    const current = selectedCertifications ?? [];
    if (current.includes(cert)) {
      setValue('certifications', current.filter((c) => c !== cert));
    } else {
      setValue('certifications', [...current, cert]);
    }
  };

  const addCustomCert = () => {
    const trimmed = customCert.trim();
    if (!trimmed) return;
    const current = selectedCertifications ?? [];
    if (!current.includes(trimmed)) {
      setValue('certifications', [...current, trimmed]);
    }
    setCustomCert('');
  };

  // Group categories: parents first, then children
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const handleFormSubmit = async (data: ProductFormData, isDraft: boolean) => {
    setServerError(null);
    try {
      await onSubmit({ ...data, images, isDraft });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg[0] : typeof msg === 'string' ? msg : 'Failed to save product');
    }
  };

  const handleValidationError = () => {
    toast.error('Please fix the highlighted errors before submitting.');
  };

  const pricingError = errors?.multiTierPricing?.root?.message ?? (errors?.multiTierPricing as any)?.message;

  return (
    <FormProvider {...methods}>
      <div className="space-y-8">
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        {/* ── Section 1: Basic Info ─────────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Basic Information
          </h3>
          <div className="space-y-5">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                placeholder="e.g. Stainless Steel Bolts M8x30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-400">Loading categories…</p>
              ) : (
                <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-3">
                  {parentCategories.map((parent) => {
                    const children = childCategories(parent.id);
                    return (
                      <div key={parent.id}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(parent.id)}
                          className={`text-sm font-medium px-3 py-1 rounded-full border transition-colors ${
                            selectedCategoryIds?.includes(parent.id)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'text-gray-700 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {parent.name}
                        </button>
                        {children.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pl-4">
                            {children.map((child) => (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => toggleCategory(child.id)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                  selectedCategoryIds?.includes(child.id)
                                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                                    : 'text-gray-500 border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                {child.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedCategoryIds?.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedCategoryIds.length} selected
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                {...register('description')}
                rows={5}
                placeholder="Describe your product — specifications, use cases, features, packaging…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Country of Origin + Availability */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country of Origin
                </label>
                <select
                  {...register('countryOfOrigin')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Availability
                </label>
                <Controller
                  name="availabilityStatus"
                  control={methods.control}
                  render={({ field }) => (
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      {(['IN_STOCK', 'OUT_OF_STOCK'] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => field.onChange(val)}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                            field.value === val
                              ? val === 'IN_STOCK'
                                ? 'bg-green-600 text-white'
                                : 'bg-red-500 text-white'
                              : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {val === 'IN_STOCK' ? 'In Stock' : 'Out of Stock'}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: Pricing & Units ────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Pricing &amp; Units
          </h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measure
                </label>
                <select
                  {...register('unit')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HSN Code{' '}
                  <a
                    href="https://www.cbic.gov.in/resources/htdocs-cbec/gst/Tariff.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 text-xs font-normal hover:underline"
                  >
                    Find HSN Code ↗
                  </a>
                </label>
                <input
                  {...register('hsnCode')}
                  type="text"
                  placeholder="e.g. 7318"
                  maxLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">4–8 digit code for GST classification</p>
              </div>
            </div>

            {/* Multi-tier pricing */}
            <PricingTable />
            {pricingError && (
              <p className="text-red-500 text-xs mt-1">{pricingError}</p>
            )}
          </div>
        </section>

        {/* ── Section 3: Images ─────────────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Product Images
          </h3>
          <ImageUploader value={images} onChange={setImages} />
        </section>

        {/* ── Section 4: Certifications ─────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Certifications
          </h3>
          <div className="space-y-4">
            {/* Preset certifications */}
            <div className="flex flex-wrap gap-2">
              {PRESET_CERTIFICATIONS.map((cert) => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCertification(cert)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCertifications?.includes(cert)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {cert}
                </button>
              ))}
            </div>

            {/* Custom certification */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customCert}
                onChange={(e) => setCustomCert(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCert())}
                placeholder="Add custom certification…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addCustomCert}
                className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Selected certifications */}
            {selectedCertifications?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCertifications.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-200"
                  >
                    {cert}
                    <button
                      type="button"
                      onClick={() => toggleCertification(cert)}
                      className="text-blue-400 hover:text-blue-600 text-base leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Submit buttons ─────────────────────────────────────── */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            disabled={isSubmitting || parentSubmitting}
            onClick={handleSubmit((data) => handleFormSubmit(data, true), handleValidationError)}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {isSubmitting || parentSubmitting ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            disabled={isSubmitting || parentSubmitting}
            onClick={handleSubmit((data) => handleFormSubmit(data, false), handleValidationError)}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 px-6 font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {isSubmitting || parentSubmitting
              ? 'Submitting…'
              : submitLabel ?? 'Submit for Review'}
          </button>
        </div>
      </div>
    </FormProvider>
  );
}
