/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRef, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const MAX_IMAGES = 10;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface UploadedImage {
  fileUrl: string;
  thumbUrl: string;
  fileName: string;
}

interface ImageUploaderProps {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}

export default function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const uploadFiles = async (files: File[]) => {
    const newErrors: string[] = [];
    const remaining = MAX_IMAGES - value.length;

    if (files.length > remaining) {
      newErrors.push(`Max ${MAX_IMAGES} images allowed. Only ${remaining} more can be added.`);
      files = files.slice(0, remaining);
    }

    const validFiles = files.filter((file) => {
      if (file.size > MAX_SIZE_BYTES) {
        newErrors.push(`"${file.name}" exceeds 5 MB limit.`);
        return false;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        newErrors.push(`"${file.name}" is not a supported image type (JPG, PNG, WebP).`);
        return false;
      }
      return true;
    });

    setErrors(newErrors);
    if (validFiles.length === 0) return;

    setUploading(true);
    const uploaded: UploadedImage[] = [];

    for (const file of validFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${API_URL}/api/upload/product-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
        });
        const data = res.data?.data;
        uploaded.push({
          fileUrl: data.fileUrl,
          thumbUrl: data.thumbUrl,
          fileName: data.fileName,
        });
      } catch (err: any) {
        newErrors.push(`Failed to upload "${file.name}": ${err?.response?.data?.message ?? 'Unknown error'}`);
      }
    }

    setErrors(newErrors);
    setUploading(false);
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadFiles(files);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  // Drag-to-reorder handlers
  const handleDragStart = (index: number) => setDraggingIndex(index);
  const handleDragEnter = (index: number) => setDragOverIndex(index);
  const handleDragEnd = () => {
    if (draggingIndex !== null && dragOverIndex !== null && draggingIndex !== dragOverIndex) {
      const reordered = [...value];
      const [moved] = reordered.splice(draggingIndex, 1);
      reordered.splice(dragOverIndex, 0, moved);
      onChange(reordered);
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const thumbSrc = (img: UploadedImage) => `${API_URL}${img.thumbUrl}`;

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      {value.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-blue-600 font-medium">Uploading & processing images…</p>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Drag & drop images here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">
                JPG, PNG, WebP · Max 5 MB per image · Up to {MAX_IMAGES} images
              </p>
              <p className="text-xs text-gray-400">Images will be auto-resized to 800×800 WebP</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600">{err}</p>
          ))}
        </div>
      )}

      {/* Image preview grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {value.map((img, index) => (
            <div
              key={img.fileUrl}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`relative group rounded-lg overflow-hidden border-2 cursor-grab aspect-square transition-all ${
                dragOverIndex === index && draggingIndex !== index
                  ? 'border-blue-400 scale-105'
                  : index === 0
                  ? 'border-blue-300'
                  : 'border-gray-200'
              }`}
            >
              <img
                src={thumbSrc(img)}
                alt={img.fileName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
              />

              {/* Primary badge */}
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-center text-xs py-0.5">
                  Primary
                </div>
              )}

              {/* Drag handle + remove */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                  className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>

              {/* Index number */}
              <div className="absolute top-1 left-1 bg-black/50 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length > 1 && (
        <p className="text-xs text-gray-400">Drag images to reorder. First image is the primary product image.</p>
      )}
    </div>
  );
}
