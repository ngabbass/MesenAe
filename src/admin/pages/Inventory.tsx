import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlusCircle, MinusCircle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import StockInPage from './StockIn';
import StockOutPage from './StockOut';
import SupplierPage from './Supplier';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'stock-in';

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="mx-auto w-full space-y-4">
      {/* Premium Segmented Tab Control */}
      <div className="flex justify-center mt-2 px-1">
        <div className="flex bg-muted/85 dark:bg-zinc-900/80 p-1 rounded-xl border border-border/60 max-w-lg w-full shadow-sm relative select-none">
          {/* Active Sliding Background Indicator */}
          <div 
            className={cn(
              "absolute top-1 bottom-1 rounded-lg bg-background shadow border border-border/40 transition-all duration-300 ease-out",
              activeTab === 'stock-in' && "left-1 w-[calc(33.333%-4px)]",
              activeTab === 'stock-out' && "left-[calc(33.333%+1.33px)] w-[calc(33.333%-4px)]",
              activeTab === 'supplier' && "left-[calc(66.666%+2px)] w-[calc(33.333%-4px)]"
            )}
          />
          <button
            onClick={() => setActiveTab('stock-in')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 outline-none select-none relative z-10",
              activeTab === 'stock-in'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Stok Masuk</span>
          </button>
          <button
            onClick={() => setActiveTab('stock-out')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 outline-none select-none relative z-10",
              activeTab === 'stock-out'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Stok Keluar</span>
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 outline-none select-none relative z-10",
              activeTab === 'supplier'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Supplier</span>
          </button>
        </div>
      </div>

      {activeTab === 'stock-in' && <StockInPage />}
      {activeTab === 'stock-out' && <StockOutPage />}
      {activeTab === 'supplier' && <SupplierPage />}
    </div>
  );
}
