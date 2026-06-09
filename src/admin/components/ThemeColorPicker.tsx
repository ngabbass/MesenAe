import { THEME_COLORS, getThemeHSL } from '@/hooks/use-theme-color';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ThemeColorPickerProps {
  value: string;
  onChange: (hue: string) => void;
}

export default function ThemeColorPicker({ value, onChange }: ThemeColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-4 sm:gap-5">
      {THEME_COLORS.map(color => {
        const isActive = value === color.hue;
        const hsl = getThemeHSL(color.hue);
        
        return (
          <div key={color.hue} className="flex flex-col items-center gap-2 group">
            <button
              onClick={() => onChange(color.hue)}
              // Memastikan tombol bisa difokuskan oleh keyboard (A11y)
              className={cn(
                'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isActive 
                  ? 'scale-110 shadow-md' 
                  : 'hover:scale-105 hover:shadow-sm cursor-pointer'
              )}
              style={{ 
                backgroundColor: `hsl(${hsl})`,
                // Efek cincin luar menggunakan box-shadow manual agar warnanya selalu presisi sesuai HSL
                boxShadow: isActive 
                  ? `0 0 0 3px hsl(var(--background)), 0 0 0 6px hsl(${hsl})` 
                  : 'none'
              }}
              title={color.name}
              aria-label={`Pilih warna ${color.name}`}
              aria-pressed={isActive}
            >
              {/* Inner Highlight (Memberi efek 3D/kedalaman pada warna terang maupun gelap) */}
              <div className="absolute inset-0 rounded-full border border-white/20 dark:border-black/20 mix-blend-overlay pointer-events-none" />
              
              {/* Animated Check Icon */}
              <div 
                className={cn(
                  "transition-all duration-300 ease-spring",
                  isActive ? "scale-100 opacity-100" : "scale-50 opacity-0"
                )}
              >
                <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
              </div>
            </button>
            
            {/* Label Nama Warna */}
            <span 
              className={cn(
                "text-[10px] font-bold tracking-wide transition-all duration-300 select-none",
                isActive 
                  ? "text-foreground opacity-100 translate-y-0" 
                  : "text-muted-foreground opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
              )}
            >
              {color.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
