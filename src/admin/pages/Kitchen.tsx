import { useDbQuery, dbUpdate } from '@/hooks/db-hooks';
import { sendPushToRole } from '@/lib/fcm';
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Transaction, TransactionItemRecord, StoreSettings } from '@/hooks/db-hooks';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { UtensilsCrossed, User, Hash, Clock, ArrowRight, Printer, ChefHat, CheckCircle2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatReceiptTable } from '@/lib/utils';
import { useThemeColor } from '@/hooks/use-theme-color';
import { usePermissions } from '@/hooks/use-permissions';

import PrintActionModal from '@/components/PrintActionModal';

// Helper component to render items
function KitchenItemsList({ transactionId }: { transactionId: number }) {
  const allItems = (useDbQuery<TransactionItemRecord>('transactionItems') || []);
  const items = allItems.filter((i) => i.transactionId === transactionId);
  
  return (
    <div className="space-y-0 mt-2">
      {items.map((item, index) => (
        <div key={item.id} className={cn(
          "flex items-start gap-3 py-3",
          index !== items.length - 1 && "border-b border-dashed border-border/60"
        )}>
          {/* Quantity Badge */}
          <div className="bg-primary/10 text-primary border border-primary/20 font-black text-sm w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            {item.quantity}
          </div>
          
          {/* Item Details */}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-bold text-foreground text-sm leading-snug break-words">{item.productName}</span>
            
            {item.selectedVariants && item.selectedVariants.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground mt-1 break-words">
                + {item.selectedVariants.map((v: any) => v.optionName).join(', ')}
              </span>
            )}
            
            {item.notes && (
              <div className="inline-flex mt-1.5">
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md leading-tight border border-amber-200">
                  📝 {item.notes}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const KITCHEN_STEPS = ['diproses', 'dimasak', 'disiapkan', 'siap', 'diantarkan'] as const;

export default function Kitchen() {
  useThemeColor();
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('kitchen');
  
  const [printActionTx, setPrintActionTx] = useState<Transaction | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  
  if (storeSettings && storeSettings.enableKitchen === false) {
    return <Navigate to="/admin" replace />;
  }

  const allBills = useDbQuery<Transaction>('transactions') || [];
  const allItems = useDbQuery<TransactionItemRecord>('transactionItems') || [];
  
  const processingBills = allBills
    .filter(t => t.needsKitchen !== false && t.kitchenStatus && t.kitchenStatus !== 'diantarkan' && t.kitchenStatus !== 'pending')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Live clock for the header
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  const handleNextStep = async (bill: Transaction) => {
    // Play beep sound immediately for fast real-time feedback
    try {
      const audio = new Audio('/beep.mp3');
      audio.play().catch(e => console.warn('[Sound] Audio play blocked/failed:', e));
    } catch (err) {}

    try {
      const currentIndex = KITCHEN_STEPS.indexOf(bill.kitchenStatus as any);
      if (currentIndex < KITCHEN_STEPS.length - 1) {
        const nextStatus = KITCHEN_STEPS[currentIndex + 1];
        const updates: Partial<Transaction> = { kitchenStatus: nextStatus };
        
        await dbUpdate('transactions', bill.id!, updates);
        
        // Saat pesanan DIANTARKAN/SELESAI → notifikasi ke customer
        if (nextStatus === 'diantarkan') {
          sendPushToRole('customer', {
            title: 'Pesanan Siap! 🍽️',
            body:  `Pesanan Anda (${bill.receiptNumber}) sudah siap${storeSettings?.deliveryMode === 'ambil' ? ', silakan diambil di kasir.' : ' dan sedang diantar ke meja Anda.'}`,
            url:   '/?view=tracking',
          }).catch(console.error);
        }
        toast.success(`Pesanan ${bill.receiptNumber} lanjut ke tahap: ${nextStatus.toUpperCase()}`);
      }
    } catch (err) {
      toast.error('Gagal memperbarui status pesanan');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'diproses': 
        return { 
          label: 'Baru Masuk', 
          badge: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30 font-bold',
          btn: 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/20',
          action: 'Mulai Masak',
          icon: <ChefHat className="w-4 h-4" />
        };
      case 'dimasak': 
        return { 
          label: 'Sedang Dimasak', 
          badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30 font-bold animate-pulse',
          btn: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20',
          action: 'Selesai Dimasak',
          icon: <Timer className="w-4 h-4" />
        };
      case 'disiapkan': 
        return { 
          label: 'Tahap Penyajian', 
          badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 font-bold',
          btn: 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20',
          action: 'Pesanan Siap',
          icon: <UtensilsCrossed className="w-4 h-4" />
        };
      case 'siap': 
        return { 
          label: storeSettings?.deliveryMode === 'ambil' ? 'Bisa Diambil' : 'Siap Diantar', 
          badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30 font-bold',
          btn: 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20',
          action: storeSettings?.deliveryMode === 'ambil' ? 'Tandai Diambil' : 'Tandai Diantar',
          icon: <CheckCircle2 className="w-4 h-4" />
        };
      default: 
        return { 
          label: status, 
          badge: 'bg-muted text-muted-foreground border-border/40 dark:bg-muted/30 dark:text-muted-foreground dark:border-border/30 font-bold',
          btn: 'bg-primary hover:bg-primary/90',
          action: 'Lanjut',
          icon: <ArrowRight className="w-4 h-4" />
        };
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola status antrean dapur.</span>
        </div>
      )}
      


      {/* Main Content */}
      {!processingBills || processingBills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-border/60">
          <div className="bg-muted p-6 rounded-full mb-4">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground/50" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Dapur Sedang Kosong</h2>
          <p className="text-muted-foreground max-w-md">
            Semua pesanan telah diselesaikan atau restoran sedang menunggu pelanggan baru.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Group 1: Baru Masuk & Dimasak */}
          {['diproses', 'dimasak', 'disiapkan', 'siap'].map((statusKey) => {
            const groupBills = processingBills.filter(b => b.kitchenStatus === statusKey);
            if (groupBills.length === 0) return null;
            
            const config = getStatusConfig(statusKey);
            
            return (
              <div key={statusKey} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm", config.badge)}>
                    {config.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground tracking-tight ml-1">{config.label}</h3>
                  <Badge variant="secondary" className="ml-2 rounded-full font-extrabold px-2.5 py-0.5 bg-muted border border-border/40 text-xs">{groupBills.length}</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {groupBills.map(bill => {
                    const billConfig = getStatusConfig(bill.kitchenStatus || 'diproses');
                    const orderDate = new Date(bill.date);
                    const diffMins = Math.floor((currentTime.getTime() - orderDate.getTime()) / 60000);
                    const isLate = diffMins > 20;
            
            return (
              <Card 
                key={bill.id} 
                className="flex flex-col border-border/60 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 ease-out overflow-hidden group"
              >
                {/* Ticket Header */}
                <CardHeader className="p-5 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="font-mono text-xs px-2.5 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                          {bill.receiptNumber}
                        </Badge>
                        <Badge className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shadow-none", billConfig.badge)}>
                          {billConfig.label}
                        </Badge>
                        {isLate && (
                          <Badge variant="destructive" className="text-[10px] px-2.5 py-0.5 font-bold uppercase animate-pulse">LATE</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground flex-wrap">
                        <div className={cn(
                          "flex items-center gap-1.5",
                          isLate && "text-red-500 font-bold"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {diffMins} mnt lalu
                        </div>
                        {bill.date && (
                          <div className="flex items-center">
                            <Timer className="w-3.5 h-3.5 mr-1.5" />
                            {format(orderDate, 'HH:mm', { locale: localeId })}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0" 
                      onClick={() => setPrintActionTx(bill)}
                      title="Pilihan Cetak"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                {/* Ticket Body (Items) */}
                <CardContent className="p-5 flex-1 flex flex-col gap-3">
                  <div className="space-y-2.5 flex-1">
                    {/* Customer Name */}
                    {bill.customerName && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <div className="bg-muted p-1.5 rounded-md mr-2.5 text-foreground/70">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground truncate">{bill.customerName}</span>
                      </div>
                    )}
                    
                    {/* Table Number */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <div className="bg-muted p-1.5 rounded-md mr-2.5 text-foreground/70">
                        <Hash className="w-4 h-4" />
                      </div>
                      <span>
                        {formatReceiptTable(bill.tableNumber)}
                      </span>
                    </div>
 
                    {/* Dashed Line Separator */}
                    <div className="h-[1px] w-full border-t border-dashed border-border/60 my-2" />
 
                    <div className="flex-1">
                      <KitchenItemsList transactionId={bill.id!} />
                    </div>
                  </div>
                </CardContent>
 
                {/* Ticket Footer (Action) */}
                {hasEditAccess && (
                  <CardFooter className="px-5 pb-5 pt-0 mt-auto shrink-0 z-20 relative">
                    <Button 
                      className={cn("w-full h-11 text-xs font-bold tracking-wide transition-all shadow-md active:scale-95 rounded-xl", billConfig.btn)}
                      onClick={() => handleNextStep(bill)}
                    >
                      <div className="mr-2 shrink-0 flex items-center justify-center">
                        {billConfig.icon}
                      </div>
                      <span>{billConfig.action}</span>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Print Action Modal — Pilihan Cetak */}
      {printActionTx && (() => {
        const txItems = allItems.filter((i) => i.transactionId === printActionTx.id);
        return (
          <PrintActionModal
            open={!!printActionTx}
            onClose={() => setPrintActionTx(null)}
            transaction={printActionTx}
            items={txItems}
            storeSettings={storeSettings}
            showCustomerReceipt={false}
            showKitchenReceipt={true}
          />
        );
      })()}
    </div>
  );
}
