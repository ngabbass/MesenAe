import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OfflineQueueService, QueueItem } from '@/lib/offlineQueue';
import { toast } from 'sonner';

export default function OfflineSyncStatus() {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Load initial status and register listeners
  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      const isOnline = await OfflineQueueService.isOnline();
      const pendingItems = await OfflineQueueService.getQueue();
      if (active) {
        setOnline(isOnline);
        setQueue(pendingItems);
      }
    };

    checkStatus();

    // Listen to our custom offline queue change event
    const handleQueueChange = async () => {
      const pendingItems = await OfflineQueueService.getQueue();
      if (active) {
        setQueue(pendingItems);
      }
    };

    // Listen to network status change online/offline events
    const handleOnlineStatus = () => {
      if (active) setOnline(true);
      handleManualSync();
    };
    const handleOfflineStatus = () => {
      if (active) setOnline(false);
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      active = false;
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;
    
    const isOnline = await OfflineQueueService.isOnline();
    setOnline(isOnline);
    
    if (!isOnline) {
      toast.error('Perangkat masih dalam keadaan offline. Tidak dapat melakukan sinkronisasi.', {
        position: 'bottom-right'
      });
      return;
    }

    const items = await OfflineQueueService.getQueue();
    if (items.length === 0) {
      toast.info('Seluruh data di perangkat sudah sinkron dengan server cloud.', {
        position: 'bottom-right'
      });
      return;
    }

    setSyncing(true);
    try {
      const result = await OfflineQueueService.syncQueue();
      if (result.success) {
        toast.success(`Sinkronisasi berhasil! ${result.syncedCount} data offline telah dikirim ke cloud.`, {
          position: 'bottom-right'
        });
      } else {
        toast.warning(`Sinkronisasi selesai sebagian. ${result.syncedCount} berhasil, ${result.failedCount} gagal.`, {
          position: 'bottom-right'
        });
      }
    } catch (error) {
      toast.error('Gagal melakukan sinkronisasi data offline.', {
        position: 'bottom-right'
      });
    } finally {
      setSyncing(false);
      const pendingItems = await OfflineQueueService.getQueue();
      setQueue(pendingItems);
    }
  };

  // Group mutations to make it human readable
  const groupedQueue = queue.reduce((acc, item) => {
    const key = `${item.tableName}_${item.type}`;
    if (!acc[key]) {
      acc[key] = {
        tableName: item.tableName,
        type: item.type,
        count: 0
      };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, { tableName: string; type: string; count: number }>);

  const getHumanReadableType = (type: string) => {
    switch (type) {
      case 'insert': return 'Penambahan';
      case 'update': return 'Pembaruan';
      case 'delete': return 'Penghapusan';
      default: return type;
    }
  };

  const getHumanReadableTable = (table: string) => {
    switch (table) {
      case 'transactions': return 'Transaksi';
      case 'transaction_items': return 'Detail Transaksi';
      case 'products': return 'Stok Produk';
      case 'categories': return 'Kategori';
      case 'suppliers': return 'Supplier';
      case 'vouchers': return 'Voucher Diskon';
      default: return table;
    }
  };

  if (online && queue.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={`flex items-center justify-center transition-all shadow-sm border shrink-0 rounded-lg h-10 w-10 relative ${
            !online 
              ? 'bg-red-500/10 border-red-500/35 hover:bg-red-500/15 hover:border-red-500/60 text-red-600 dark:text-red-400 animate-pulse' 
              : queue.length > 0 
                ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500 text-amber-600 dark:text-amber-400' 
                : 'bg-background/80 border-border/60 hover:border-border text-muted-foreground'
          }`}
          title={
            !online 
              ? 'Mode Offline (Penyimpanan Lokal)' 
              : queue.length > 0 
                ? `${queue.length} Data Menunggu Sinkronisasi` 
                : 'Sistem Terhubung & Sinkron'
          }
        >
          {/* Small cloud-off icon when offline, standard cloud otherwise */}
          {!online ? (
            <>
              <CloudOff className="w-4.5 h-4.5 text-red-500 dark:text-red-400 shrink-0" />
              {queue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-background animate-pulse">
                  {queue.length}
                </span>
              )}
            </>
          ) : (
            <>
              {queue.length > 0 ? (
                <Cloud className="w-4.5 h-4.5 text-amber-500 animate-bounce" />
              ) : (
                <Cloud className="w-4.5 h-4.5 text-emerald-500" />
              )}
              
              {/* Unsynced Badge */}
              {queue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white ring-2 ring-background animate-pulse">
                  {queue.length}
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
        align="end" 
        className={`${
          !online ? 'w-56 p-3' : 'w-80 p-0'
        } rounded-xl border border-border/60 shadow-2xl overflow-hidden`}
      >
        {!online ? (
          /* Simple compact layout when offline */
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-extrabold text-xs">
              <WifiOff className="w-4 h-4 shrink-0" />
              Mode Offline
            </div>
            <p className="text-[10px] leading-normal text-muted-foreground font-semibold">
              POS berjalan lokal. Data otomatis disinkronkan saat terhubung kembali ke internet.
            </p>
            {queue.length > 0 ? (
              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md py-1 px-2 w-full text-center">
                {queue.length} data tersimpan di perangkat
              </div>
            ) : (
              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 border border-emerald-500/25 rounded-md py-1 px-2 w-full text-center">
                Semua data lokal sinkron
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full text-[10px] font-bold h-7.5 border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
              onClick={handleManualSync}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                  Sinkron...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Coba Sinkron
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Standard sync management layout when online */
          <>
            {/* Header */}
            <div className="bg-muted/40 p-4 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                  <Wifi className="w-4 h-4" /> Online
                </span>
              </div>
              <Badge className={`text-[10px] font-bold border-transparent ${
                queue.length > 0 
                  ? 'bg-amber-500 text-white hover:bg-amber-600' 
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}>
                {queue.length > 0 ? `${queue.length} Belum Sinkron` : '100% Sinkron'}
              </Badge>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/80" />
                  <p className="text-xs font-extrabold text-foreground">Semua Data Sinkron</p>
                  <p className="text-[10px] text-muted-foreground max-w-[200px]">
                    Seluruh transaksi offline dan perubahan stok telah berhasil diamankan di server cloud.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-500">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-extrabold">Data Pending di Perangkat</span>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {Object.values(groupedQueue).map((group, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border/40 text-[11px] font-semibold">
                        <span className="text-muted-foreground">
                          {getHumanReadableType(group.type)} {getHumanReadableTable(group.tableName)}
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-bold py-0 px-1.5">
                          {group.count} item
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Button */}
              {queue.length > 0 && (
                <Button
                  className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-extrabold text-xs h-9 shadow-md rounded-lg gap-2"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Sinkronkan Sekarang
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
