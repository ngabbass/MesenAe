/**
 * AccessDeniedBanner — Banner "Mode Lihat Saja" yang muncul di halaman
 * ketika user tidak memiliki izin "kelola" (edit) untuk modul tersebut.
 * 
 * Gunakan komponen ini di bagian atas konten halaman, dengan kondisi:
 *   {!canEdit('moduleName') && <AccessDeniedBanner />}
 */
import { Lock } from 'lucide-react';

interface AccessDeniedBannerProps {
  /** Pesan kustom opsional. Default: "Mode Lihat Saja: Anda tidak memiliki izin untuk mengelola fitur ini." */
  message?: string;
  className?: string;
}

export default function AccessDeniedBanner({ message, className = '' }: AccessDeniedBannerProps) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none ${className}`}>
      <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>
        {message ?? (
          <>
            <strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola fitur ini.
          </>
        )}
      </span>
    </div>
  );
}
