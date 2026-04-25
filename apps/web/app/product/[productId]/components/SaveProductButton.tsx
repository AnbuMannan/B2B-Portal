'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export default function SaveProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    axios.get(`${API_URL}/api/buyer/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const products: { id: string }[] = res.data?.data?.products ?? [];
        setSaved(products.some((p) => p.id === productId));
      })
      .catch(() => {});
  }, [productId]);

  const handleToggle = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push(`/auth/signin?returnUrl=/product/${productId}`); return; }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/buyer/save/product/${productId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const isSaved: boolean = res.data?.data?.saved ?? false;
      setSaved(isSaved);
      showToast(isSaved ? 'Product saved to your list' : 'Product removed from saved list');
    } catch {
      showToast('Failed to update saved list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <button
        onClick={handleToggle}
        disabled={loading}
        title={saved ? 'Remove from saved products' : 'Save product'}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
          saved
            ? 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
        } disabled:opacity-50`}
      >
        <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        {saved ? 'Saved' : 'Save Product'}
      </button>
    </>
  );
}
