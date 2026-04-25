/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import PricingTable from './PricingTable';
import ImageUploader from './ImageUploader';

const RichTextEditor = dynamic(() => import('../../../../components/editor/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-300 rounded-lg h-40 animate-pulse bg-gray-50" />
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const UNITS = ['PIECE', 'KG', 'LITRE', 'METRE', 'TON', 'BOX', 'BUNDLE', 'PACK'];
const COUNTRIES = ['India', 'China', 'USA', 'Germany', 'Japan', 'South Korea', 'Taiwan', 'UAE', 'UK', 'Other'];
const STOCKED_IN_TYPES = ['Box', 'Strip', 'Unit', 'Bottle', 'Tablet', 'Vial', 'Bag', 'Roll', 'Pallet', 'Other'];
const PRESET_CERTIFICATIONS = [
  'ISO 9001', 'ISO 14001', 'FSSAI', 'Drug Licence', 'CE Mark', 'BIS', 'REACH', 'RoHS',
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
  // new fields
  partModelNumber: z.string().optional(),
  minimumOrderQuantity: z.coerce.number().min(1).optional().or(z.literal('')).transform((v) => v === '' ? undefined : v),
  taxPercentage: z.coerce.number().min(0).max(100).optional().or(z.literal('')).transform((v) => v === '' ? undefined : v),
  tags: z.array(z.string()),
  buyersPreferredFrom: z.array(z.string()),
  manufacturerName: z.string().optional(),
  manufacturerCountry: z.string().optional(),
  aboutManufacturer: z.string().optional(),
  stockedInCountry: z.string().optional(),
  stockedInQuantity: z.coerce.number().min(0).optional().or(z.literal('')).transform((v) => v === '' ? undefined : v),
  stockedInType: z.string().optional(),
  estimatedShippingDays: z.coerce.number().int().min(1).optional().or(z.literal('')).transform((v) => v === '' ? undefined : v),
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
  for (const [key, tier] of Object.entries(data.multiTierPricing)) {
    if (tier?.enabled) {
      if (!tier.price || tier.price <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price is required for enabled tier', path: ['multiTierPricing', key, 'price'] });
      }
      if (!tier.moq || tier.moq < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MOQ is required for enabled tier', path: ['multiTierPricing', key, 'moq'] });
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
  const [tagInput, setTagInput] = useState('');
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
      partModelNumber: defaultValues?.partModelNumber ?? '',
      minimumOrderQuantity: defaultValues?.minimumOrderQuantity ?? ('' as any),
      taxPercentage: defaultValues?.taxPercentage ?? ('' as any),
      tags: defaultValues?.tags ?? [],
      buyersPreferredFrom: defaultValues?.buyersPreferredFrom ?? [],
      manufacturerName: defaultValues?.manufacturerName ?? '',
      manufacturerCountry: defaultValues?.manufacturerCountry ?? '',
      aboutManufacturer: defaultValues?.aboutManufacturer ?? '',
      stockedInCountry: defaultValues?.stockedInCountry ?? '',
      stockedInQuantity: defaultValues?.stockedInQuantity ?? ('' as any),
      stockedInType: defaultValues?.stockedInType ?? '',
      estimatedShippingDays: defaultValues?.estimatedShippingDays ?? ('' as any),
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
  const selectedTags = watch('tags');
  const selectedBuyersFrom = watch('buyersPreferredFrom');

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
    setValue('categoryIds', current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);
  };

  const toggleCertification = (cert: string) => {
    const current = selectedCertifications ?? [];
    setValue('certifications', current.includes(cert) ? current.filter((c) => c !== cert) : [...current, cert]);
  };

  const addCustomCert = () => {
    const trimmed = customCert.trim();
    if (!trimmed) return;
    const current = selectedCertifications ?? [];
    if (!current.includes(trimmed)) setValue('certifications', [...current, trimmed]);
    setCustomCert('');
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const current = selectedTags ?? [];
    if (!current.includes(trimmed)) setValue('tags', [...current, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setValue('tags', (selectedTags ?? []).filter((t) => t !== tag));
  };

  const toggleBuyersFrom = (country: string) => {
    const current = selectedBuyersFrom ?? [];
    setValue('buyersPreferredFrom', current.includes(country) ? current.filter((c) => c !== country) : [...current, country]);
  };

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

        {/* ── Section 1: Basic Information ─────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Basic Information
          </h3>
          <div className="space-y-5">
            {/* Product Name + Part/Model Number */}
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Part / Model Number
                </label>
                <input
                  {...register('partModelNumber')}
                  type="text"
                  placeholder="e.g. SKF-6206 or M8-30/SS"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Letters, numbers, hyphens and slashes</p>
              </div>
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
                <p className="text-xs text-gray-500 mt-1">{selectedCategoryIds.length} selected</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Controller
                name="description"
                control={methods.control}
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Describe your product — specifications, use cases, features, packaging…"
                    minHeight="160px"
                  />
                )}
              />
              <p className="text-xs text-gray-400 mt-1">Supports bold, italic, lists and headings.</p>
            </div>

            {/* Country of Origin + Availability */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                <select
                  {...register('countryOfOrigin')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
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
                              ? val === 'IN_STOCK' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
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

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags <span className="text-gray-400 font-normal text-xs">(for search — e.g. Gloves, Masks)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Type a tag and press Enter or Add"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Add
                </button>
              </div>
              {(selectedTags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(selectedTags ?? []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full border border-indigo-200">
                      #{tag}
                      <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-600 text-base leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Buyers Preferred From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buyers Preferred From <span className="text-gray-400 font-normal text-xs">(countries you supply to)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[...COUNTRIES, 'All Countries'].map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => toggleBuyersFrom(country)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      (selectedBuyersFrom ?? []).includes(country)
                        ? 'bg-green-600 text-white border-green-600'
                        : 'text-gray-600 border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {country}
                  </button>
                ))}
              </div>
              {(selectedBuyersFrom ?? []).length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{(selectedBuyersFrom ?? []).length} selected</p>
              )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                <select
                  {...register('unit')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
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

            <div className="grid grid-cols-2 gap-4">
              {/* Minimum Order Quantity (global) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Order Quantity
                </label>
                <input
                  {...register('minimumOrderQuantity')}
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Global MOQ (overrides tier MOQ for display)</p>
                {(errors as any).minimumOrderQuantity && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).minimumOrderQuantity.message}</p>
                )}
              </div>

              {/* Tax % */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Tax % <span className="text-gray-400 font-normal text-xs">(GST rate)</span>
                </label>
                <input
                  {...register('taxPercentage')}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="e.g. 18"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Numeric only — 18 means 18%</p>
                {(errors as any).taxPercentage && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).taxPercentage.message}</p>
                )}
              </div>
            </div>

            {/* Multi-tier pricing */}
            <PricingTable />
            {pricingError && <p className="text-red-500 text-xs mt-1">{pricingError}</p>}
          </div>
        </section>

        {/* ── Section 3: Manufacturer Information ───────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Manufacturer Information
          </h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer Name</label>
                <input
                  {...register('manufacturerName')}
                  type="text"
                  placeholder="e.g. Tata Steel Ltd"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer Country</label>
                <select
                  {...register('manufacturerCountry')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About Manufacturer</label>
              <textarea
                {...register('aboutManufacturer')}
                rows={3}
                placeholder="Brief description of the manufacturer — location, specialisation, certifications…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Section 4: Inventory & Shipping ───────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Inventory &amp; Shipping
          </h3>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {/* Stocked In Country */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stocked In Country</label>
                <select
                  {...register('stockedInCountry')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Stocked In Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stocked In Quantity</label>
                <input
                  {...register('stockedInQuantity')}
                  type="number"
                  min={0}
                  placeholder="e.g. 5000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(errors as any).stockedInQuantity && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).stockedInQuantity.message}</p>
                )}
              </div>

              {/* Stocked In Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stocked In Type</label>
                <select
                  {...register('stockedInType')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {STOCKED_IN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Est. Shipping Days */}
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Est. Shipping Time <span className="text-gray-400 font-normal text-xs">(max days)</span>
              </label>
              <input
                {...register('estimatedShippingDays')}
                type="number"
                min={1}
                placeholder="e.g. 7"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">If 5–7 days, enter 7</p>
              {(errors as any).estimatedShippingDays && (
                <p className="text-red-500 text-xs mt-1">{(errors as any).estimatedShippingDays.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 5: Product Images ─────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Product Images
          </h3>
          <ImageUploader value={images} onChange={setImages} />
        </section>

        {/* ── Section 6: Certifications ─────────────────────────── */}
        <section>
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Certifications
          </h3>
          <div className="space-y-4">
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
            {isSubmitting || parentSubmitting ? 'Submitting…' : submitLabel ?? 'Submit for Review'}
          </button>
        </div>
      </div>
    </FormProvider>
  );
}
