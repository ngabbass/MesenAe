import React from 'react';
import { cn } from '@/lib/utils';
import { type TransactionItemRecord } from '@/hooks/db-hooks';

export default function KitchenItemSummary({
  items,
  isExpanded,
}: {
  items: TransactionItemRecord[];
  isExpanded: boolean;
}) {
  const summary = items.map((i) => `${i.quantity}× ${i.productName}`).join(', ');
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span
        className="text-xs font-semibold text-foreground truncate max-w-[180px] lg:max-w-[360px]"
        title={summary}
      >
        {summary || '—'}
      </span>
      <span
        className={cn(
          'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap transition-colors',
          isExpanded
            ? 'text-primary bg-primary/10 border-primary/20'
            : 'text-muted-foreground bg-muted/50 border-border',
        )}
      >
        {isExpanded ? '▲ Tutup' : '▼ Detail'}
      </span>
    </div>
  );
}
