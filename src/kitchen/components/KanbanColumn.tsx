import React from 'react';
import { cn } from '@/lib/utils';
import type { KanbanStepKey, StageConfig } from '../constants';
import type { Transaction, TransactionItemRecord } from '@/hooks/db-hooks';
import KanbanTicket from './KanbanTicket';

interface KanbanColumnProps {
  stepKey: KanbanStepKey;
  config: StageConfig;
  bills: Transaction[];
  currentTime: Date;
  onPrintAction: (bill: Transaction) => void;
  onNextStep: (bill: Transaction) => void;
  allTxItems: TransactionItemRecord[];
}

const KanbanColumn = React.memo(({
  stepKey, config, bills, currentTime, onPrintAction, onNextStep, allTxItems,
}: KanbanColumnProps) => (
  <div className="flex flex-col bg-slate-200/30 dark:bg-slate-900/40 rounded-2xl border border-slate-300 dark:border-slate-800/80 overflow-hidden h-full shadow-inner">

    {/* Column header */}
    <div className={cn('px-4 py-3 border-b border-slate-300 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0', config.headerBg)}>
      <div className="flex items-center gap-2.5">
        <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center shrink-0', config.iconWrap)}>
          <config.Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-foreground leading-tight">{config.label}</h3>
          <p className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
            {config.shortLabel}
          </p>
        </div>
      </div>
      <div
        className={cn(
          'text-sm font-black px-2.5 py-1 rounded-lg border min-w-[32px] text-center tabular-nums shrink-0',
          bills.length > 0 ? config.countBadge : 'bg-muted/60 text-muted-foreground/40 border-border',
        )}
      >
        {bills.length}
      </div>
    </div>

    {/* Scrollable ticket area */}
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {bills.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-center opacity-35 pointer-events-none">
          <config.Icon className="w-9 h-9 text-muted-foreground mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">{config.emptyText}</p>
        </div>
      ) : (
        bills.map((bill) => (
          <KanbanTicket
            key={bill.id}
            bill={bill}
            config={config}
            currentTime={currentTime}
            onPrintAction={onPrintAction}
            onNextStep={onNextStep}
            items={allTxItems.filter((i) => i.transactionId === bill.id)}
          />
        ))
      )}
    </div>
  </div>
));

KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
