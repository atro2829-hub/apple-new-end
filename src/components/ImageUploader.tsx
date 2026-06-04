'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';

interface ImageUploaderProps {
  value: string; // current base64 string or empty
  onChange: (base64: string) => void;
  size?: number; // max dimension (default 200)
  quality?: number; // 0-1 (default 0.7)
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function ImageUploader({
  value,
  onChange,
  size = 200,
  quality = 0.7,
  placeholder = 'Upload image',
  className = '',
  icon,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          reject(new Error('Failed to read file'));
          return;
        }

        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');

          // Calculate dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > size) {
              height = Math.round((height * size) / width);
              width = size;
            }
          } else {
            if (height > size) {
              width = Math.round((width * size) / height);
              height = size;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw image onto canvas with new dimensions
          ctx.drawImage(img, 0, 0, width, height);

          // Export as JPEG with specified quality
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = dataUrl;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    try {
      const base64 = await compressImage(file);
      onChange(base64);
    } catch (error) {
      console.error('Image compression failed:', error);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const defaultIcon = (
    <div className="flex flex-col items-center gap-2">
      <Camera className="h-8 w-8 text-[#1B7A3D]" strokeWidth={1.5} />
      <span className="text-xs text-muted-foreground">{placeholder}</span>
    </div>
  );

  return (
    <div
      className={`relative group cursor-pointer ${className}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label={value ? 'Change image' : placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />

      <div
        className={`
          w-full h-full rounded-2xl overflow-hidden
          flex items-center justify-center
          transition-all duration-200 ease-in-out
          ${value
            ? 'bg-transparent'
            : `bg-muted/50 border-2 border-dashed border-muted-foreground/20 hover:border-[#1B7A3D]/50 hover:bg-[#1B7A3D]/5 ${isDragging ? 'border-[#1B7A3D] bg-[#1B7A3D]/10' : ''}`
          }
        `}
      >
        {value ? (
          <div className="relative w-full h-full">
            <img
              src={value}
              alt="Uploaded image"
              className="w-full h-full object-cover rounded-2xl"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 rounded-2xl flex items-center justify-center">
              <Upload className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" strokeWidth={1.5} />
            </div>

            {/* Remove button */}
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500 hover:scale-110 active:scale-95"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="p-4 flex flex-col items-center justify-center">
            {icon ?? defaultIcon}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageUploader;
