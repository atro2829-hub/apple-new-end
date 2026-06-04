import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compress an image file to a base64 JPEG string.
 * Resizes to fit within maxSize pixels on the longest side, then encodes as JPEG at the given quality.
 */
export function compressImageToBase64(file: File, maxSize: number = 512, quality: number = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Normalize a card/redeem code:
 * - Converts Arabic numerals (٠-٩) to Latin (0-9)
 * - Converts Persian numerals (۰-۹) to Latin (0-9)
 * - Strips all whitespace
 * - Converts to uppercase
 */
export function normalizeCode(code: string): string {
  return code
    .trim()
    // Convert Arabic-Indic numerals ٠-٩ → 0-9
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    // Convert Persian numerals ۰-۹ → 0-9
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    // Strip all whitespace
    .replace(/\s/g, "")
    // Uppercase
    .toUpperCase();
}

// ============================================================================
// Security — Input Validation Helpers
// ============================================================================

/**
 * Sanitize text input — remove HTML tags, trim whitespace.
 * Prevents XSS by stripping any HTML-like content.
 */
export function sanitizeInput(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")  // Remove HTML tags
    .trim();
}

/**
 * Validate email format.
 * Uses a practical regex that covers most common email patterns.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (Yemen format).
 * Accepts formats: +9677XXXXXXXX, 7XXXXXXXX
 * Yemen mobile numbers: local part is exactly 9 digits starting with 7.
 */
export function isValidYemenPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  const yemenPhoneRegex = /^(\+967)?7[0-9]{8}$/;
  return yemenPhoneRegex.test(cleaned);
}

/**
 * Validate amount (positive number, within optional range).
 * @param amount - The amount to validate
 * @param min - Optional minimum value (inclusive)
 * @param max - Optional maximum value (inclusive)
 */
export function isValidAmount(amount: number, min?: number, max?: number): boolean {
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) return false;
  if (amount <= 0) return false;
  if (min !== undefined && amount < min) return false;
  if (max !== undefined && amount > max) return false;
  return true;
}
