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
        {/* Gagang kantong */}
        <path d="M9 8V5a3 3 0 0 1 6 0v3" />
        
        {/* Badan kantong (trapesium terbalik dengan sudut bawah membulat) */}
        <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
        
        {/* Logo Makanan (Mangkuk) di depan kantong */}
        <path d="M9 14h6a3 3 0 0 1-6 0Z" />
        
        {/* Uap panas */}
        <path d="M11 11v1" />
        <path d="M13 11v1" />
      </svg>
    );
  }
);
TakeawayIcon.displayName = "TakeawayIcon";
