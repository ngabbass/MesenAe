import React from 'react';
import { format } from 'date-fns';
import { Clock, Printer, Package2, User } from 'lucide-react';
import { cn, formatReceiptTable } from '@/lib/utils';
import type { Transaction, TransactionItemRecord } from '@/hooks/db-hooks';
import { type StageConfig, getTimerConfig } from '../constants';
import KitchenDisplayItemsList from './KitchenDisplayItemsList';

interface KanbanTicketProps {
  bill: Transaction;
  config: StageConfig;
  currentTime: Date;
  onPrintAction: (bill: Transaction) => void;
  onNextStep: (bill: Transaction) => void;
  items: TransactionItemRecord[];
  compact?: boolean;
}

const KanbanTicket = React.memo(({
  bill, config, currentTime, onPrintAction, onNextStep, items, compact = false,
}: KanbanTicketProps) => {
  const orderDate = new Date(bill.date);
  const diffMins = Math.floor((currentTime.getTime() - orderDate.getTime()) / 60000);
  const timer = getTimerConfig(diffMins);
  const tableDisplay = formatReceiptTable(bill.tableNumber);
  const isTakeaway = tableDisplay === 'Bawa Pulang';

  return (
    <div
      className={cn(
        'flex flex-col bg-card rounded-2xl border border-slate-300 dark:border-slate-800/85 border-l-4 shadow-md',
        'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden',
        'ring-1 ring-black/[0.03] dark:ring-white/[0.03]',
        config.borderLeft,
      )}
    >
      {/* ── TICKET HEADER ── */}
      <div className={cn(compact ? 'px-3 pt-2.5 pb-2' : 'px-3.5 pt-3 pb-2.5', config.headerBg)}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('font-mono font-semibold text-muted-foreground tracking-wider truncate', compact ? 'text-[10px]' : 'text-[11px]')}>
            {bill.receiptNumber}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Timer badge */}
            <span
              className={cn(
                'font-bold px-2 py-0.5 rounded-full border flex items-center gap-1',
                compact ? 'text-[9px]' : 'text-[10px]',
                timer.className,
                timer.pulse && 'animate-pulse',
              )}
            >
              <Clock className="w-2.5 h-2.5 shrink-0" />
              {timer.label}
            </span>
            {/* Print */}
            <button
              onClick={() => onPrintAction(bill)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors border border-transparent hover:border-border"
              title="Cetak Tiket Dapur"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLE / ORDER TYPE ── */}
      <div className={cn('border-b border-dashed border-border/50 flex items-center justify-between gap-2', compact ? 'px-3 py-2' : 'px-3.5 py-2.5')}>
        {isTakeaway ? (
          <div className="flex items-center gap-2">
            <div className={cn('rounded-xl bg-muted border border-border flex items-center justify-center shrink-0', compact ? 'w-8 h-8' : 'w-10 h-10')}>
              <Package2 className={cn('text-muted-foreground', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                Tipe Order
              </p>
              <p className={cn('font-black text-foreground leading-snug', compact ? 'text-xs' : 'text-sm')}>Bawa Pulang</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Large table number display */}
            <div
              className={cn(
                'border-2 flex items-center justify-center font-black leading-none tabular-nums shrink-0',
                compact ? 'w-10 h-10 rounded-lg text-lg' : 'w-14 h-14 rounded-xl text-2xl'
              )}
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', color: 'var(--primary)' }}
            >
              {tableDisplay}
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
                Nomor Meja
              </p>
              <p className="text-xs font-semibold text-muted-foreground leading-snug mt-0.5">
                {format(orderDate, 'HH:mm')}
              </p>
            </div>
          </div>
        )}

        {bill.customerName && (
          <div className={cn('flex items-center gap-1 bg-muted/60 rounded-lg px-2 py-1 border border-border shrink-0', compact ? 'max-w-[75px]' : 'max-w-[90px]')}>
            <User className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
            <span className={cn('font-bold text-foreground truncate', compact ? 'text-[9px]' : 'text-[10px]')}>{bill.customerName}</span>
          </div>
        )}
      </div>

      {/* ── ITEMS ── */}
      <div className={cn('flex-1', compact ? 'px-3 py-2.5' : 'px-3.5 py-3')}>
        <KitchenDisplayItemsList items={items} compact={compact} />
      </div>

      {/* ── ACTION BUTTON ── */}
      <div className={cn('shrink-0', compact ? 'px-2.5 pb-2.5' : 'px-3 pb-3')}>
        <button
          onClick={() => onNextStep(bill)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl',
            compact ? 'h-8 text-xs font-black' : 'h-10 text-sm font-black',
            'tracking-wide transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            config.btnClass,
          )}
        >
          <config.ActionIcon className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          {config.actionText}
        </button>
      </div>
    </div>
  );
});

KanbanTicket.displayName = 'KanbanTicket';

export default KanbanTicket;
