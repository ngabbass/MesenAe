import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, UtensilsCrossed } from 'lucide-react';
import type { Transaction, TransactionItemRecord } from '@/hooks/db-hooks';
import { getLocalCache } from '@/hooks/db-hooks';
import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { mapTransactionItem } from '@/lib/sync';

function ProcessingBillCard({ bill, onComplete }: { bill: Transaction, onComplete: () => void }) {
  const [items, setItems] = useState<TransactionItemRecord[]>([]);
  useEffect(() => {
    if (!bill.id) return;
    getLocalCache('transaction_items').then((cachedItems) => {
      const filtered = cachedItems.filter((item: any) => String(item.transaction_id) === String(bill.id));
      setItems(filtered.map((r: any) => mapTransactionItem(r)));
    });
  }, [bill.id]);
  return (
    <Card className="border-border shadow-sm mb-3">
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2 border-b pb-2">
          <div>
            <Badge variant="outline" className="font-mono text-xs">{bill.receiptNumber}</Badge>
            <div className="text-xs text-muted-foreground mt-1">
              {bill.customerName && <span className="mr-2">👤 {bill.customerName}</span>}
              {bill.tableNumber && (
                <span>
                  🪑 {String(bill.tableNumber).toLowerCase() === 'bawa pulang' || String(bill.tableNumber).toLowerCase() === 'take away'
                    ? 'Bawa Pulang'
                    : 'Meja ' + String(bill.tableNumber).replace(/^(meja\s+)+/i, '')}
                </span>
              )}
            </div>
          </div>
          <Badge className="bg-blue-500 hover:bg-blue-600 capitalize">{bill.kitchenStatus || 'diproses'}</Badge>
        </div>
        <div className="space-y-1 mb-3">
          {items.map(item => (
            <div key={item.id} className="text-xs flex justify-between border-b border-border/30 last:border-0 pb-1 last:pb-0">
              <span className="font-medium">{item.quantity}x {item.productName}</span>
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full text-xs gap-2" onClick={onComplete}>
          <CheckCircle className="w-3.5 h-3.5" />
          Selesaikan Pesanan
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProcessingBillsModal({
  open,
  onOpenChange,
  processingBills,
  onCompleteBill
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processingBills: Transaction[];
  onCompleteBill: (id: number) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5" />
            Pesanan Diproses ({processingBills.length})
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 overflow-y-auto h-[calc(80vh-80px)] pb-20 scrollbar-hide">
          {processingBills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Tidak ada pesanan yang sedang diproses.</div>
          ) : (
            processingBills.map(b => (
              <ProcessingBillCard
                key={b.id}
                bill={b}
                onComplete={() => onCompleteBill(b.id!)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
