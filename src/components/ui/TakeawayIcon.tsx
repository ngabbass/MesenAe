import React from 'react';
import { LucideProps } from 'lucide-react';

export const TakeawayIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ color = "currentColor", size = 24, strokeWidth = 2, className = "", ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`lucide lucide-takeaway-bag ${className}`}
        {...props}
      >
        {/* Bentuk utama kantong kertas (meruncing ke bawah) */}
        <path d="M6 6h12l-1.5 16h-9L6 6Z" />
        
        {/* Gagang kantong di bagian atas */}
        <path d="M9 6V4a3 3 0 0 1 6 0v2" />
        
        {/* Detail visual (sendok dan garpu) di dalam kantong agar jelas itu Makanan */}
        {/* Gagang sendok & garpu */}
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        
        {/* Kepala garpu */}
        <path d="M9 11c0 .5.5 1 1 1h0c.5 0 1-.5 1-1" />
        
        {/* Kepala sendok */}
        <path d="M13.5 11.5a1.5 1.5 0 1 0 1 0v-.5Z" />
      </svg>
    );
  }
);
TakeawayIcon.displayName = "TakeawayIcon";
