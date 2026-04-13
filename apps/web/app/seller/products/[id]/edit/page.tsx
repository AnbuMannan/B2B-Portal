/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import ProductForm from '../../components/ProductForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Product {
  id: string;
  name: string;
  description?: string;
  hsnCode?: string;
  unit?: string;
  countryOfOrigin?: string;
  availabilityStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  multiTierPricing: any;
  images: string[];
  certifications: string[];
  categories: { id: string; name: string }[];
  adminApprovalStatus: string;
  isActive: boolean;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/seller/products/${id}`, {
          headers: authHeaders(),
        });
        setProduct(res.data.data);
      } catch {
        toast.error('Product not found');
        router.push('/seller/products');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
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

      await axios.patch(`${API_URL}/api/seller/products/${id}`, payload, {
        headers: authHeaders(),
      });

      if (data.isDraft) {
        toast.success('Product saved as draft.');
      } else {
        toast.success('Product updated. Pending admin review if critical fields changed.');
      }

      setSubmitting(false);
      setTimeout(() => router.push('/seller/products'), 1500);
    } catch (err: any) {
      setSubmitting(false);
      const msg = err?.response?.data?.message;
      const message = Array.isArray(msg) ? msg[0] : typeof msg === 'string' ? msg : 'Failed to update product';
      throw { response: { data: { message } } };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!product) return null;

  // Convert stored image URLs into UploadedImage shape for the form
  const defaultImages = product.images.map((url) => ({
    fileUrl: url,
    thumbUrl: url.replace(/\/([^/]+\.webp)$/, '/thumb/$1'),
    fileName: url.split('/').pop() ?? 'image.webp',
  }));

  // Normalize multiTierPricing: ensure boolean enabled flags and
  // fall back to retail enabled=true if no tier is enabled (e.g. legacy data)
  const rawPricing = product.multiTierPricing ?? {};
  const normalizeTier = (tier: any) =>
    tier
      ? { price: tier.price ?? undefined, moq: tier.moq ?? undefined, enabled: Boolean(tier.enabled) }
      : { price: undefined, moq: undefined, enabled: false };

  const normalizedPricing = {
    retail: normalizeTier(rawPricing.retail),
    wholesale: normalizeTier(rawPricing.wholesale),
    bulk: normalizeTier(rawPricing.bulk),
  };

  const hasAnyEnabled =
    normalizedPricing.retail.enabled ||
    normalizedPricing.wholesale.enabled ||
    normalizedPricing.bulk.enabled;

  if (!hasAnyEnabled) {
    normalizedPricing.retail.enabled = true;
  }

  const defaultValues = {
    name: product.name,
    description: product.description,
    hsnCode: product.hsnCode,
    unit: product.unit,
    countryOfOrigin: product.countryOfOrigin,
    availabilityStatus: product.availabilityStatus,
    categoryIds: product.categories.map((c) => c.id),
    certifications: product.certifications ?? [],
    multiTierPricing: normalizedPricing,
    images: defaultImages,
  };

  const wasApproved = product.adminApprovalStatus === 'APPROVED';

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
        <span className="text-gray-900 font-medium line-clamp-1">{product.name}</span>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-sm text-gray-500 mt-1">
              Update your product details below.
            </p>
          </div>
          <span
            className={`mt-1 flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              product.adminApprovalStatus === 'APPROVED'
                ? 'bg-green-100 text-green-700'
                : product.adminApprovalStatus === 'REJECTED'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {product.adminApprovalStatus === 'APPROVED'
              ? 'Approved'
              : product.adminApprovalStatus === 'REJECTED'
              ? 'Rejected'
              : 'Pending Review'}
          </span>
        </div>

        {wasApproved && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            <strong>Note:</strong> Changing the product name, HSN code, pricing, or images will
            reset the approval status to <em>Pending Review</em>.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <ProductForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isSubmitting={submitting}
          submitLabel="Save & Submit for Review"
        />
      </div>
    </div>
  );
}
