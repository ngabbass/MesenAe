import React from 'react';
import { cn } from '@/lib/utils';
import { type Banner } from '@/hooks/db-hooks';
import { Gift } from 'lucide-react';
import { cldBanner, cldUrl } from '@/lib/cld';

interface PromoBannerProps {
  banner: Banner;
  className?: string;
  onAction?: () => void;
}

const hexToRgb = (hex: string) => {
  if (!hex) return '0, 0, 0';
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
};

export default function PromoBanner({ banner, className, onAction }: PromoBannerProps) {
  // ── Position defaults (x/y/w matching editor defaults) ──────────────────
  const headingP = banner.headingPos ?? { x: 10, y: 20, w: 40 };
  const titleP   = banner.titlePos   ?? { x: 10, y: 38, w: 60 };
  const descP    = banner.descPos    ?? { x: 10, y: 60, w: 60 };
  const buttonP  = banner.buttonPos  ?? { x: 10, y: 82, w: 60 };
  const overP    = banner.overlayPos ?? { x: 80, y: 50 };

  // ── Background image filter ──────────────────────────────────────────────
  const bgFilter = banner.canvasBgFilter || { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
  const bgFilterStyle = `brightness(${bgFilter.brightness}%) contrast(${bgFilter.contrast}%) saturate(${bgFilter.saturate}%) blur(${bgFilter.blur}px)`;

  // ── Overlay image filter  (saved as canvasOverlayFilter in Firestore) ────
  const overlayFilter = (banner as any).canvasOverlayFilter || { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
  const overlayFilterStyle = `brightness(${overlayFilter.brightness}%) contrast(${overlayFilter.contrast}%) saturate(${overlayFilter.saturate ?? 100}%) blur(${overlayFilter.blur}px)`;

  // ── Overlay border-radius ────────────────────────────────────────────────
  const overlayBorderRadius = (banner as any).overlayBorderRadius ?? 0;

  // ── Gradient overlay (dark/colour wash on top of bg image) ──────────────
  const bgGradientOverlay = banner.bgGradientOverlay as any;

  // ── Heading style lookup ─────────────────────────────────────────────────
  const headingStyleMap = (style: string | undefined) => ({
    backgroundColor:
      style === 'solid-white'   ? '#FFFFFF' :
      style === 'solid-dark'    ? '#09090b' :
      style === 'outline-white' ? 'transparent' :
      style === 'neon'          ? 'rgba(34,211,238,0.15)' :
      style === 'retro'         ? '#fbbf24' :
      'rgba(255,255,255,0.2)',  // default = glass

    color:
      style === 'solid-white'   ? '#0f172a' :
      style === 'solid-dark'    ? '#ffffff' :
      style === 'outline-white' ? '#ffffff' :
      style === 'neon'          ? '#a5f3fc' :
      style === 'retro'         ? '#09090b' :
      '#ffffff',

    border:
      style === 'solid-white'   ? 'none' :
      style === 'solid-dark'    ? '1px solid #1e293b' :
      style === 'outline-white' ? '0.2cqw solid #ffffff' :
      style === 'neon'          ? '0.15cqw solid #22d3ee' :
      style === 'retro'         ? '0.2cqw solid #09090b' :
      '0.1cqw solid rgba(255,255,255,0.1)',

    boxShadow:
      style === 'neon'   ? '0 0 12px rgba(34,211,238,0.4)' :
      style === 'retro'  ? '0.25cqw 0.25cqw 0px #09090b' :
      'none',

    backdropFilter:
      (style === 'glass' || !style) ? 'blur(8px)' : undefined,
  });

  // ── Button style lookup ──────────────────────────────────────────────────
  const buttonStyleMap = (style: string | undefined) => ({
    backgroundColor:
      style === 'solid'     ? '#FFFFFF' :
      style === 'outline'   ? 'transparent' :
      style === 'glass'     ? 'rgba(255,255,255,0.2)' :
      style === 'soft-dark' ? 'rgba(0,0,0,0.4)' :
      style === 'neon'      ? '#06b6d4' :
      style === 'retro'     ? '#eab308' :
      '#FFFFFF',

    color:
      style === 'solid'     ? '#0F172A' :
      style === 'outline'   ? '#FFFFFF' :
      style === 'glass'     ? '#FFFFFF' :
      style === 'soft-dark' ? '#FFFFFF' :
      style === 'neon'      ? '#ffffff' :
      style === 'retro'     ? '#09090b' :
      '#0F172A',

    border:
      style === 'outline'   ? '0.2cqw solid #FFFFFF' :
      style === 'glass'     ? '0.15cqw solid rgba(255,255,255,0.2)' :
      style === 'soft-dark' ? '0.15cqw solid rgba(255,255,255,0.2)' :
      style === 'retro'     ? '0.25cqw solid #09090b' :
      'none',

    boxShadow:
      style === 'neon'   ? '0 0 15px rgba(6,182,212,0.6)' :
      style === 'retro'  ? '0.3cqw 0.3cqw 0px #09090b' :
      'none',

    backdropFilter:
      (style === 'glass' || style === 'soft-dark') ? 'blur(8px)' : undefined,
  });

  return (
    <div
      className={cn(
        'w-full aspect-[21/9] rounded-2xl text-white relative overflow-hidden shadow-md select-none bg-slate-900',
        className,
      )}
      style={{
        background:
          banner.bgType === 'solid'    ? banner.bgColor :
          banner.bgType === 'gradient' ? banner.bgGradient :
          undefined,
        containerType: 'inline-size',
      }}
    >
      {/* ── LAYER 1: BACKGROUND ────────────────────────────────────────── */}
      {(!banner.bgType || banner.bgType === 'image') && banner.imageUrl && !banner.imageUrl.startsWith('preset:') ? (
        <div className="absolute inset-0 z-0">
          <img
            src={cldBanner(banner.imageUrl)}
            alt={banner.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-55"
            style={{ filter: bgFilterStyle }}
          />
          {bgGradientOverlay?.enabled ? (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(${bgGradientOverlay.angle ?? 90}deg, rgba(${hexToRgb(bgGradientOverlay.color || '#000000')}, ${(bgGradientOverlay.opacityLeft ?? 70) / 100}), rgba(${hexToRgb(bgGradientOverlay.color || '#000000')}, ${(bgGradientOverlay.opacityRight ?? 0) / 100}))`,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          )}
        </div>
      ) : banner.bgType === 'solid' ? (
        <div className="absolute inset-0 z-0" style={{ backgroundColor: banner.bgColor || '#1E293B' }}>
          {!banner.overlayImageUrl && (
            <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg] z-0" />
          )}
        </div>
      ) : banner.bgType === 'gradient' && banner.bgGradient ? (
        <div className="absolute inset-0 z-0" style={{ background: banner.bgGradient }}>
          {!banner.overlayImageUrl && (
            <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg] z-0" />
          )}
        </div>
      ) : (
        <div
          className={cn(
            'absolute inset-0 z-0 bg-gradient-to-br',
            banner.imageUrl === 'preset:green'  ? 'from-emerald-600 via-teal-600 to-cyan-600' :
            banner.imageUrl === 'preset:red'    ? 'from-rose-600 via-red-600 to-orange-600' :
            banner.imageUrl === 'preset:purple' ? 'from-fuchsia-600 via-purple-600 to-violet-600' :
            banner.imageUrl === 'preset:orange' ? 'from-orange-500 via-amber-500 to-yellow-500' :
            'from-blue-600 via-indigo-600 to-purple-600',
          )}
        >
          {!banner.overlayImageUrl && (
            <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg] z-0" />
          )}
        </div>
      )}

      {/* ── LAYER 2: OVERLAYS (stiker/produk PNG) ───────────────────────────── */}
      {Array.isArray((banner as any).overlays) && (banner as any).overlays.map((overlay: any, idx: number) => {
        const overlayFilterStyle = `brightness(${overlay.filter?.brightness ?? 100}%) contrast(${overlay.filter?.contrast ?? 100}%) saturate(${overlay.filter?.saturate ?? 100}%) blur(${overlay.filter?.blur ?? 0}px)`;
        return (
          <div
            key={overlay.id}
            className="absolute pointer-events-none"
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 5 + idx,
              width: `calc(${overlay.scale ?? 1} * 20cqw)`,
            }}
          >
            <img
              src={cldUrl(overlay.imageUrl, { q: 'auto', f: 'auto' })}
              style={{
                transform: `scaleX(${overlay.flipX ? -1 : 1}) rotate(${overlay.rotate ?? 0}deg)`,
                filter: overlayFilterStyle,
                borderRadius: `${overlay.borderRadius ?? 0}%`,
              }}
              className="w-full h-auto object-contain drop-shadow-2xl pointer-events-none"
              decoding="async"
              alt="Overlay Banner"
            />
          </div>
        );
      })}

      {/* ── LAYER 3: HEADING BADGE ──────────────────────────────────────── */}
      {banner.heading && (
        <div
          style={{
            position: 'absolute',
            left: `${headingP.x}%`,
            top: `${headingP.y}%`,
            transform: 'translate(0%, -50%)',
            zIndex: 10,
            width: `${headingP.w ?? 40}%`,
          }}
        >
          <span
            style={headingStyleMap(banner.headingStyle)}
            className="text-[2.2cqw] px-[1.5cqw] py-[0.5cqw] rounded inline-block uppercase tracking-widest"
            dangerouslySetInnerHTML={{ __html: banner.heading }}
          />
        </div>
      )}

      {/* ── LAYER 4: TITLE ─────────────────────────────────────────────── */}
      {banner.title && (
        <div
          style={{
            position: 'absolute',
            left: `${titleP.x}%`,
            top: `${titleP.y}%`,
            transform: 'translate(0%, -50%)',
            zIndex: 10,
            width: `${titleP.w ?? 60}%`,
          }}
        >
          <h4
            className="font-black text-[4.5cqw] leading-[1.15] line-clamp-2 drop-shadow-sm m-0 text-left"
            dangerouslySetInnerHTML={{ __html: banner.title }}
          />
        </div>
      )}

      {/* ── LAYER 5: DESCRIPTION ───────────────────────────────────────── */}
      {banner.description && (
        <div
          style={{
            position: 'absolute',
            left: `${descP.x}%`,
            top: `${descP.y}%`,
            transform: 'translate(0%, -50%)',
            zIndex: 10,
            width: `${descP.w ?? 60}%`,
          }}
        >
          <p
            className="text-[2.8cqw] text-slate-100 line-clamp-3 leading-[1.3] font-medium drop-shadow-sm m-0 text-left"
            dangerouslySetInnerHTML={{ __html: banner.description }}
          />
        </div>
      )}

      {/* ── LAYER 6: BUTTON ────────────────────────────────────────────── */}
      {(onAction || banner.link || banner.buttonText) && (
        <div
          style={{
            position: 'absolute',
            left: `${buttonP.x}%`,
            top: `${buttonP.y}%`,
            transform: 'translate(0%, -50%)',
            zIndex: 10,
          }}
        >
          <button
            onClick={e => {
              e.stopPropagation();
              if (banner.link) {
                if (banner.link.startsWith('http')) window.open(banner.link, '_blank');
                else window.location.href = banner.link;
              } else if (onAction) {
                onAction();
              }
            }}
            style={buttonStyleMap(banner.badgeStyle)}
            className="text-[2.4cqw] font-extrabold px-[2.5cqw] py-[0.8cqw] rounded-md shadow-sm hover:opacity-90 active:scale-95 transition-all inline-block pointer-events-auto"
          >
            {banner.buttonText || 'Lihat Detail'}
          </button>
        </div>
      )}
    </div>
  );
}
