import React from 'react';
import { CashierProvider, useCashier } from './cashier/CashierContext';
import CashierCatalog from './cashier/CashierCatalog';
import CashierCart from './cashier/CashierCart';
import CashierModals from './cashier/CashierModals';
import { CashierSkeleton } from '@/admin/components/SkeletonLoaders';

function CashierContent() {
  const { loading, hasEditAccess } = useCashier();

  if (loading) {
    return <CashierSkeleton />;
  }

  return (
    <div className="pt-2 pb-24 w-full flex flex-col">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk membuat transaksi / pesanan baru.</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-0 md:gap-4">
        <CashierCatalog />
        <CashierCart />
      </div>
      <CashierModals />
    </div>
  );
}

export default function Kasir() {
  return (
    <CashierProvider>
      <CashierContent />
    </CashierProvider>
  );
}
