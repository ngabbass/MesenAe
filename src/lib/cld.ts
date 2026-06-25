/**
 * Cloudinary URL Optimizer
 * ========================
 * Generates optimized Cloudinary delivery URLs with automatic:
 *  - f_auto  → WebP/AVIF based on browser support
 *  - q_auto  → automatic quality compression
 *  - c_fill  → smart cropping for fixed-size slots
 *  - w/h     → responsive resizing (no oversized downloads)
 *
 * Usage:
 *   cldUrl(photo, { w: 400, h: 400 })       → thumbnail
 *   cldUrl(photo, { w: 800 })                → medium preview
 *   cldUrl(photo)                            → auto-optimized, no resize
 *
 * Non-Cloudinary URLs are returned as-is (no transform applied).
 */

export interface CldOptions {
  w?: number;
  h?: number;
  crop?: 'fill' | 'fit' | 'thumb' | 'scale' | 'pad';
  q?: 'auto' | number;
  f?: 'auto' | 'webp' | 'avif';
  /** Extra arbitrary transform string appended after the standard transforms */
  extra?: string;
}

/**
 * Transform a Cloudinary URL to an optimized delivery URL.
 * Returns the original URL unchanged if it's not a Cloudinary URL.
 */
export function cldUrl(url: string | null | undefined, opts: CldOptions = {}): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') && !url.includes('cloudinary.com')) {
    return url;
  }

  const {
    w,
    h,
    crop = 'fill',
    q = 'auto',
    f = 'auto',
    extra,
  } = opts;

  // Build transform string
  const transforms: string[] = [`f_${f}`, `q_${q}`];

  if (w) transforms.push(`w_${w}`);
  if (h) transforms.push(`h_${h}`);
  if ((w || h) && crop) transforms.push(`c_${crop}`);
  if (extra) transforms.push(extra);

  const transformStr = transforms.join(',');

  // Insert transforms after /upload/
  // Handles both versioned (/upload/v123456/) and non-versioned (/upload/) URLs
  return url.replace(/\/upload\/(?:v\d+\/)?/, (match) => {
    return match.replace('/upload/', `/upload/${transformStr}/`);
  });
}

// ── Preset sizes for consistent usage ────────────────────────────────────────

/** 64×64 — Icon / avatar / small logo */
export const cldThumbSm = (url: string | null | undefined) =>
  cldUrl(url, { w: 64, h: 64, crop: 'fill' });

/** 200×200 — Product card thumbnail (mobile grid) */
export const cldThumb = (url: string | null | undefined) =>
  cldUrl(url, { w: 200, h: 200, crop: 'fill' });

/** 400×400 — Product card thumbnail (desktop grid / cashier) */
export const cldThumbLg = (url: string | null | undefined) =>
  cldUrl(url, { w: 400, h: 400, crop: 'fill' });

/** 800×450 — Banner / wide image */
export const cldBanner = (url: string | null | undefined) =>
  cldUrl(url, { w: 800, h: 450, crop: 'fill' });

/** 1200×675 — Full-width hero banner */
export const cldHero = (url: string | null | undefined) =>
  cldUrl(url, { w: 1200, h: 675, crop: 'fill' });

/** Full quality, auto format, no resize — for lightbox/full preview */
export const cldFull = (url: string | null | undefined) =>
  cldUrl(url, { q: 'auto', f: 'auto' });
