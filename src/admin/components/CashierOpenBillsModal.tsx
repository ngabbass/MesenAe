import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Trash2 } from 'lucide-react';
import type { Transaction } from '@/hooks/db-hooks';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function OpenBillsModal({
  open,
  onOpenChange,
  openBills,
  onLoadBill,
  onCancelBill
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openBills: Transaction[];
  onLoadBill: (bill: Transaction) => void;
  onCancelBill: (bill: Transaction) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Open Bills ({openBills?.length || 0})
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 overflow-y-auto h-[calc(80vh-80px)] pb-20 scrollbar-hide space-y-3">
          {!openBills || openBills.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Tidak ada tagihan yang terbuka</p>
            </div>
          ) : (
            openBills.map(bill => (
              <Card key={bill.id} className="border-border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge variant="outline" className="font-mono text-xs mb-1 bg-muted">
                        {bill.receiptNumber}
                      </Badge>
                      <div className="font-semibold text-sm">
                        {bill.customerName || 'Tamu'}
                        {bill.tableNumber && (
                          <span className="text-muted-foreground ml-1">
                            ({String(bill.tableNumber).toLowerCase() === 'bawa pulang' || String(bill.tableNumber).toLowerCase() === 'take away'
                              ? 'Bawa Pulang'
                              : 'Meja ' + String(bill.tableNumber).replace(/^(meja\s+)+/i, '')})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(bill.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary text-sm">Rp {(bill.total || 0).toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs font-semibold"
                      onClick={() => onLoadBill(bill)}
                    >
                      Buka & Bayar
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 text-xs text-destructive border-destructive/30"
                      onClick={() => onCancelBill(bill)}
                    >
                      Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
