import React from 'react';
import { cn } from '@/lib/utils';
import { type TransactionItemRecord } from '@/hooks/db-hooks';

export default function KitchenDisplayItemsList({
  items,
  compact = false,
  plainQuantity = false,
}: {
  items: TransactionItemRecord[];
  compact?: boolean;
  plainQuantity?: boolean;
}) {
  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-2.5',
            !compact &&
              index !== items.length - 1 &&
              'pb-2.5 border-b border-dashed border-border/60',
          )}
        >
          {/* Quantity */}
          {plainQuantity ? (
            <span
              className={cn(
                'shrink-0 font-extrabold text-foreground tabular-nums min-w-[20px] text-left mt-0.5',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {item.quantity}x
            </span>
          ) : (
            <div
              className={cn(
                'shrink-0 font-black rounded-lg text-primary bg-primary/10 border border-primary/20 flex items-center justify-center tabular-nums',
                compact
                  ? 'text-xs min-w-[26px] h-[26px] px-1'
                  : 'text-sm min-w-[32px] h-[32px] px-1.5 mt-0.5',
              )}
            >
              {item.quantity}×
            </div>
          )}

          {/* Item info */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-bold text-foreground leading-snug',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {item.productName}
            </p>

            {item.selectedVariants && item.selectedVariants.length > 0 && (
              <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight">
                {item.selectedVariants.map((v: any) => v.optionName).join(' · ')}
              </p>
            )}

            {item.notes && (
              <span
                className={cn(
                  'inline-block mt-1 rounded px-1.5 py-0.5 leading-tight font-semibold',
                  'text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25',
                  compact ? 'text-[10px]' : 'text-xs',
                )}
              >
                📝 {item.notes}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
