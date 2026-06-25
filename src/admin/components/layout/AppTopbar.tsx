import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { dbUpdate } from '@/hooks/db-hooks';
import OfflineSyncStatus from '../OfflineSyncStatus';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Maximize, 
  Minimize, 
  User, 
  Bell, 
  LogOut, 
  LayoutDashboard, 
  ShoppingCart, 
  ClipboardList, 
  Store, 
  Calculator, 
  Clock, 
  UtensilsCrossed, 
  History, 
  Package, 
  QrCode, 
  Ticket, 
  FileText, 
  Settings,
  Menu,
  KeyRound,
  CheckCircle,
  ArrowDownToLine,
  Printer,
  Tag as TagIcon,
  Image as ImageIcon,
  Moon, 
  Sun, 
  Loader2,
  Wallet,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDbQuery } from '@/hooks/db-hooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppTopbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleMobileSidebar?: () => void;
}

export default function AppTopbar({ isFullscreen, onToggleFullscreen, onToggleMobileSidebar }: AppTopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const storeSettingsList = useDbQuery<any>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  const authData = JSON.parse(localStorage.getItem('admin_auth') || '{}');
  const role = authData.role || 'admin';
  const username = authData.username || 'Staf Kasir';
  const displayName = authData.name || username;

  // Dark/Light Mode State
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDark(isDark);
  }, []);
  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('mesenae-theme', newDark ? 'dark' : 'light');
  };

  // Profile Modal State
  const [profileDialog, setProfileDialog] = useState(false);

  // Dynamic Page Info based on path
  const getPageInfo = (pathname: string) => {
    if (pathname === '/admin' || pathname === '/admin/') {
      return {
        title: 'Dashboard',
        description: 'Ringkasan performa dan analitik penjualan real-time.',
        icon: <LayoutDashboard className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/cashier')) {
      return {
        title: 'Kasir POS',
        description: 'Sistem pencatatan transaksi cepat dan terintegrasi.',
        icon: <ShoppingCart className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/orders') || pathname.includes('/admin/active-orders')) {
      return {
        title: 'Pesanan Aktif',
        description: 'Pantau pesanan pelanggan yang sedang berjalan.',
        icon: <ClipboardList className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/kitchen')) {
      return {
        title: 'Layar Dapur',
        description: 'Kelola status masakan dan antrean dapur.',
        icon: <UtensilsCrossed className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/history')) {
      return {
        title: 'Riwayat Transaksi',
        description: 'Daftar lengkap transaksi penjualan yang telah diselesaikan.',
        icon: <History className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/products')) {
      return {
        title: 'Daftar Produk',
        description: 'Kelola varian, harga, HPP, dan ketersediaan menu.',
        icon: <Package className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/supplier')) {
      return {
        title: 'Kelola Supplier',
        description: 'Manajemen data mitra pemasok bahan baku.',
        icon: <Package className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/inventory')) {
      return {
        title: 'Manajemen Stok',
        description: 'Kelola penyesuaian stok masuk, stok keluar, dan data supplier.',
        icon: <Package className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/barcode')) {
      return {
        title: 'Cetak Barcode',
        description: 'Desain dan cetak label harga atau barcode.',
        icon: <Printer className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/stock-report')) {
      return {
        title: 'Laporan Stok',
        description: 'Rekapitulasi pergerakan mutasi persediaan barang.',
        icon: <Package className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/qr-code')) {
      return {
        title: 'QR Code Meja',
        description: 'Unduh dan kelola kode QR untuk pemesanan mandiri.',
        icon: <QrCode className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/qris-dinamis')) {
      return {
        title: 'Konverter QRIS',
        description: 'Ubah QRIS Statis Anda menjadi QRIS Dinamis dengan nominal dan biaya admin khusus.',
        icon: <QrCode className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/banner')) {
      return {
        title: 'Banner Tampilan',
        description: 'Kelola banner dan penawaran menarik di halaman pelanggan.',
        icon: <ImageIcon className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/vouchers')) {
      return {
        title: 'Voucher Diskon',
        description: 'Konfigurasi diskon, potongan harga, dan kupon aktif.',
        icon: <Ticket className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/reports')) {
      return {
        title: 'Laporan Bisnis',
        description: 'Analisis laba kotor, margin penjualan, dan pergerakan stok.',
        icon: <FileText className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/settings')) {
      return {
        title: 'Pengaturan Sistem',
        description: 'Konfigurasi info toko, meja, dan preferensi aplikasi.',
        icon: <Settings className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/categories')) {
      return {
        title: 'Kategori Produk',
        description: 'Kelola jenis dan pengelompokan menu.',
        icon: <TagIcon className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/expenses')) {
      return {
        title: 'Pengeluaran',
        description: 'Catat biaya operasional toko.',
        icon: <Wallet className="w-5 h-5 text-warning" />
      };
    }
    if (pathname.includes('/admin/customers')) {
      return {
        title: 'Data Pelanggan',
        description: 'Riwayat dari Self Order & Kasir.',
        icon: <Users className="w-5 h-5 text-primary" />
      };
    }
    if (pathname.includes('/admin/supplier')) {
      return {
        title: 'Data Supplier',
        description: 'Kelola daftar pemasok bahan baku Anda.',
        icon: <Package className="w-5 h-5 text-primary" />
      };
    }

    return {
      title: 'Panel Admin',
      description: 'Selamat datang di pusat kendali MesenAe.',
      icon: <Settings className="w-5 h-5 text-primary" />
    };
  };

  const pageInfo = getPageInfo(location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    sessionStorage.removeItem('cashier_session_state');
    navigate('/login');
  };

  return (
    <div className="app-topbar w-full bg-card/65 backdrop-blur-xl border-b border-border/40 shadow-sm px-6 py-4 flex items-center justify-between gap-4 animate-in fade-in duration-300">
      
      {/* Kiri: Judul Halaman Dinamis */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleMobileSidebar}
            className="lg:hidden h-9 w-9 p-0 hover:bg-accent/40 rounded-lg mr-1 shrink-0"
          >
            <Menu className="w-5.5 h-5.5 text-foreground" />
          </Button>
        )}
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
          {pageInfo.icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-foreground tracking-tight leading-tight flex items-center gap-2">
            {pageInfo.title}
          </h2>
          <p className="text-xs font-medium text-muted-foreground truncate hidden md:block mt-0.5">
            {pageInfo.description}
          </p>
        </div>
      </div>

      {/* Kanan: Actions & Profile */}
      <div className="flex items-center gap-3.5 shrink-0">
        
        {/* Offline Sync Status Badge */}
        <OfflineSyncStatus />

        {/* Dark/Light Mode Button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleDarkMode} 
          className="bg-background/80 backdrop-blur-sm border-border/60 hover:bg-accent/40 rounded-lg h-10 w-10 shrink-0 shadow-sm"
          title={isDark ? "Mode Terang" : "Mode Gelap"}
        >
          {isDark ? <Sun className="w-4.5 h-4.5 text-muted-foreground" /> : <Moon className="w-4.5 h-4.5 text-muted-foreground" />}
        </Button>

        {/* Fullscreen Button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onToggleFullscreen} 
          className="bg-background/80 backdrop-blur-sm border-border/60 hover:bg-accent/40 rounded-lg h-10 w-10 flex shrink-0 shadow-sm"
          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
        >
          {isFullscreen ? <Minimize className="w-4.5 h-4.5 text-muted-foreground" /> : <Maximize className="w-4.5 h-4.5 text-muted-foreground" />}
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 p-1 px-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-accent/40 hover:border-border transition-all focus:outline-none shrink-0">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-black text-xs flex items-center justify-center shadow-sm uppercase">
                {displayName.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-foreground leading-tight truncate max-w-[100px]">{displayName}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mt-0.5">{role}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg border-border/60 shadow-xl p-1.5">
            <DropdownMenuLabel className="px-2.5 py-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">{displayName}</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/60" />
            <DropdownMenuItem 
              onClick={() => setProfileDialog(true)}
              className="rounded-md py-2 cursor-pointer font-semibold text-xs text-muted-foreground hover:text-foreground gap-2"
            >
              <User className="w-4 h-4" /> Profil Pengguna
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="rounded-md py-2 cursor-pointer font-bold text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
            >
              <LogOut className="w-4 h-4" /> Keluar Sistem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {/* Profil Modal */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4" /> Profil Pengguna
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nama Lengkap</Label>
              <div className="text-sm font-semibold p-2.5 bg-accent/30 border border-border/50 rounded-lg">{authData.name || '-'}</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Username</Label>
              <div className="text-sm font-semibold p-2.5 bg-accent/30 border border-border/50 rounded-lg">{authData.username}</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">No WhatsApp</Label>
              <div className="text-sm font-semibold p-2.5 bg-accent/30 border border-border/50 rounded-lg">{authData.whatsapp || '-'}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
