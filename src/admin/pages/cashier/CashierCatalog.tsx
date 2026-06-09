import React from 'react';
import { useCashier } from './CashierContext';
import { Search, ScanBarcode, Barcode, Package as PackageIcon } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cldThumb } from '@/lib/cld';
import { cn } from '@/lib/utils';

const CashierCatalog: React.FC = React.memo(() => {
  const {
    search,
    setSearch,
    setScannerOpen,
    scanInput,
    setScanInput,
    scanInputRef,
    handleScanKeyDown,
    filterCategory,
    setFilterCategory,
    categories,
    products,
    filtered,
    addToCart,
    hasEditAccess
  } = useCashier();

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none mb-4 animate-in fade-in duration-300">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola transaksi kasir.</span>
        </div>
      )}


      {/* Search */}
      <div className="flex gap-2 mb-2 py-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari produk..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 h-10" 
          />
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="w-5 h-5" />
        </Button>
      </div>

      {/* SKU / Barcode scan input */}
      <div className="flex gap-2 mb-2 py-1">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={scanInputRef}
            placeholder="Scan / ketik SKU atau Barcode lalu Enter..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScanKeyDown}
            className="pl-9 h-10 text-sm"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1 pr-4" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
        <button 
          onClick={() => setFilterCategory('all')} 
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors', 
            filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          Semua
        </button>
        {categories?.map(c => (
          <button 
            key={c.id} 
            onClick={() => setFilterCategory(c.id!.toString())} 
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors', 
              filterCategory === c.id!.toString() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {products && products.length > 0
                ? 'Semua produk stoknya habis. Tambah stok dulu di menu Stok Masuk.'
                : 'Belum ada produk. Tambah produk dulu di menu Produk.'}
            </p>
          </div>
        ) : filterCategory === 'all' ? (
          <div className="space-y-6">
            {categories?.map(c => {
              const catProducts = filtered.filter(p => String(p.categoryId) === String(c.id));
              if (catProducts.length === 0) return null;
              return (
                <div key={c.id} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-sm">{c.icon}</span>
                    <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                      {c.name}
                    </h4>
                    <div className="h-[1px] flex-1 bg-border/60 ml-2" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {catProducts.map(p => (
                      <Card 
                        key={p.id} 
                        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" 
                        onClick={() => addToCart(p)}
                      >
                        <CardContent className="p-0">
                          <div className="w-full aspect-square bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                            {p.photo ? (
                              <img src={cldThumb(p.photo)} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                              <PackageIcon className="w-8 h-8 text-muted-foreground/30" />
                            )}
                          </div>
                          <div className="p-2.5">
                            <h3 className="text-xs font-semibold truncate">{p.name}</h3>
                            <p className="text-sm font-bold text-primary mt-0.5">Rp {(p.price || 0).toLocaleString('id-ID')}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock} {p.unit}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Uncategorized products */}
            {(() => {
              const uncategorized = filtered.filter(p => !categories?.some(c => String(c.id) === String(p.categoryId)));
              if (uncategorized.length === 0) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-sm">📦</span>
                    <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                      Lain-lain
                    </h4>
                    <div className="h-[1px] flex-1 bg-border/60 ml-2" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {uncategorized.map(p => (
                      <Card 
                        key={p.id} 
                        className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" 
                        onClick={() => addToCart(p)}
                      >
                        <CardContent className="p-0">
                          <div className="w-full aspect-square bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                            {p.photo ? (
                              <img src={cldThumb(p.photo)} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                              <PackageIcon className="w-8 h-8 text-muted-foreground/30" />
                            )}
                          </div>
                          <div className="p-2.5">
                            <h3 className="text-xs font-semibold truncate">{p.name}</h3>
                            <p className="text-sm font-bold text-primary mt-0.5">Rp {(p.price || 0).toLocaleString('id-ID')}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock} {p.unit}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(p => (
              <Card 
                key={p.id} 
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" 
                onClick={() => addToCart(p)}
              >
                <CardContent className="p-0">
                  <div className="w-full aspect-square bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                    {p.photo ? (
                      <img src={cldThumb(p.photo)} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-semibold truncate">{p.name}</h3>
                    <p className="text-sm font-bold text-primary mt-0.5">Rp {(p.price || 0).toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock} {p.unit}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

CashierCatalog.displayName = 'CashierCatalog';

export default CashierCatalog;
