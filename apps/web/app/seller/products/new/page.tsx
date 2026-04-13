/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import ProductForm from '../components/ProductForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export default function NewProductPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    }>
      <NewProductPageInner />
    </Suspense>
  );
}

function NewProductPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDuplicate = searchParams.get('from') === 'duplicate';

  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDuplicate) {
      try {
        const raw = sessionStorage.getItem('duplicateProduct');
        if (raw) {
          const parsed = JSON.parse(raw);
          setDuplicateData(parsed);
          sessionStorage.removeItem('duplicateProduct');
        }
      } catch {}
    }
  }, [isDuplicate]);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        hsnCode: data.hsnCode || undefined,
        unit: data.unit || undefined,
        countryOfOrigin: data.countryOfOrigin || 'India',
        availabilityStatus: data.availabilityStatus,
        categoryIds: data.categoryIds ?? [],
        certifications: data.certifications ?? [],
        multiTierPricing: data.multiTierPricing,
        images: data.images.map((img: any) => img.fileUrl),
        isDraft: data.isDraft,
      };

      await axios.post(`${API_URL}/api/seller/products`, payload, {
        headers: authHeaders(),
      });

      if (data.isDraft) {
        toast.success('Product saved as draft.');
      } else {
        toast.success('Product submitted for review. Approval within 24 hours.');
      }

      setTimeout(() => router.push('/seller/products'), 1500);
    } catch (err: any) {
      setSubmitting(false);
      const msg = err?.response?.data?.message;
      const message = Array.isArray(msg) ? msg[0] : typeof msg === 'string' ? msg : 'Failed to create product';
      throw { response: { data: { message } } };
    }
  };

  // Build defaultValues for duplicate
  const defaultValues = duplicateData
    ? {
        name: `${duplicateData.name} (Copy)`,
        description: duplicateData.description,
        hsnCode: duplicateData.hsnCode,
        unit: duplicateData.unit,
        countryOfOrigin: duplicateData.countryOfOrigin,
        availabilityStatus: duplicateData.availabilityStatus,
        categoryIds: (duplicateData.categories ?? []).map((c: any) => c.id),
        certifications: duplicateData.certifications ?? [],
        multiTierPricing: duplicateData.multiTierPricing ?? {},
        images: [], // don't copy images for duplicates
      }
    : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Toaster position="top-right" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/seller/products" className="hover:text-blue-600 transition-colors">
          My Products
        </Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">
          {isDuplicate ? 'Duplicate Product' : 'New Product'}
        </span>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isDuplicate ? 'Duplicate Product' : 'Add New Product'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isDuplicate
            ? 'Review the pre-filled details and make changes before submitting.'
            : 'Fill in the details below. Your product will be reviewed within 24 hours of submission.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <ProductForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isSubmitting={submitting}
        />
      </div>
    </div>
  );
}
