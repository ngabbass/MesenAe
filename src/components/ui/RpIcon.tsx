import React from 'react';
import { LucideProps } from 'lucide-react';

export const RpIcon = React.forwardRef<SVGSVGElement, LucideProps>(
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
        className={`lucide lucide-receipt-rupiah ${className}`}
        {...props}
      >
        {/* Kertas Struk (Ujung bawah zig-zag) */}
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2Z" />
        
        {/* Garis detail pesanan di bagian atas struk */}
        <path d="M7 7h10" />
        
        {/* Huruf R (Garis vektor murni) */}
        <path d="M7.5 16V11h2a1.5 1.5 0 0 1 0 3H7.5" />
        <path d="M9.5 14l1.5 2" />
        
        {/* Huruf p (Garis vektor murni, menurun ke bawah) */}
        <path d="M13.5 18V13h2a1.5 1.5 0 0 1 0 3H13.5" />
      </svg>
    );
  }
);
RpIcon.displayName = "RpIcon";
