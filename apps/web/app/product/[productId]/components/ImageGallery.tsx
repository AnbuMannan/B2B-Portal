'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  images: string[];
  productName: string;
}

export default function ImageGallery({ images, productName }: Props) {
  const validImages = images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const [errorSet, setErrorSet] = useState<Set<number>>(new Set());

  const markError = (i: number) => setErrorSet((prev) => new Set(prev).add(i));
  const src = validImages[selected];
  const hasError = errorSet.has(selected);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Main image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50 group">
        {src && !hasError ? (
          <Image
            key={src}
            src={src}
            alt={`${productName} — image ${selected + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            priority={selected === 0}
            onError={() => markError(selected)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 gap-2">
            <span className="text-6xl">📦</span>
            <span className="text-sm text-gray-500">{productName}</span>
          </div>
        )}
      </div>

      {/* Thumbnail strip — only shown when 2+ images */}
      {validImages.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {validImages.map((thumbSrc, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                i === selected
                  ? 'border-blue-600 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              aria-label={`View image ${i + 1}`}
            >
              {!errorSet.has(i) ? (
                <Image
                  src={thumbSrc}
                  alt={`${productName} thumbnail ${i + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  loading="lazy"
                  onError={() => markError(i)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-lg">📦</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
