import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  QrCode,
  FileText,
  Settings,
  ChevronDown,
  Ticket,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Image as ImageIcon,
  Barcode,
  ChefHat,
  Clock,
  Boxes,
  Wallet,
  Users,
} from "lucide-react";
import { useState, useEffect, useMemo, memo } from "react";
import { useDbQuery } from '@/hooks/db-hooks';
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";

interface AppSidebarProps {
  isMobile?: boolean;
}

// ── Optimized standalone NavItem ──────────────────────────────────────────────
const NavItem = memo(({ 
  to, 
  icon: Icon, 
  label, 
  badge = 0, 
  exact = false, 
  urgentBadge = false, 
  isCollapsed, 
  pathname 
}: { 
  to: string; 
  icon: any; 
  label: string; 
  badge?: number; 
  exact?: boolean; 
  urgentBadge?: boolean; 
  isCollapsed: boolean; 
  pathname: string;
}) => {
  const isActive = exact 
    ? pathname === to || pathname === to + '/' || (to === "/admin" && pathname.startsWith("/admin/qris-dinamis"))
    : pathname.startsWith(to);
  
  const isUrgent = badge > 0 && urgentBadge;
  
  return (
    <NavLink
      to={to}
      title={isCollapsed ? label : undefined}
      className={cn(
        "group relative flex items-center px-3 py-2.5 my-1 rounded-lg transition-all duration-300 text-sm font-medium outline-none",
        isCollapsed ? "justify-center" : "gap-3",
        isActive 
          ? "bg-gradient-to-r from-primary/20 to-transparent text-white font-bold" 
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
      )}
    >
      {isActive && (
        <div className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-300",
          isCollapsed ? "h-5 w-1" : "h-6 w-1.5"
        )} />
      )}
      
      <Icon className={cn(
        "w-5 h-5 shrink-0 transition-all duration-300", 
        isActive ? "text-primary filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-400 group-hover:text-slate-200"
      )} />
      
      {!isCollapsed && <span className="flex-1 truncate tracking-wide">{label}</span>}
      
      {badge > 0 && (
        <div className="relative flex items-center justify-center">
          <Badge 
            variant="default" 
            className={cn(
              "relative text-[10px] px-1.5 h-5 justify-center rounded-full flex shrink-0 items-center font-bold border-none transition-all duration-300", 
              isActive 
                ? "bg-white text-primary shadow-sm" 
                : isUrgent 
                  ? "bg-primary text-white shadow-md shadow-primary/40" 
                  : "bg-slate-700/80 text-slate-300",
              isCollapsed ? "absolute -top-1 -right-1 px-1 h-4 min-w-[16px] text-[8px] ring-2 ring-[#0a1128]" : "min-w-[22px]"
            )}
          >
            {badge > 99 ? '99+' : badge}
          </Badge>
        </div>
      )}
    </NavLink>
  );
});

NavItem.displayName = "NavItem";

// ── Optimized NavGroupLabel ──────────────────────────────────────────────
const NavGroupLabel = memo(({ children, isCollapsed }: { children: React.ReactNode; isCollapsed: boolean }) => {
  if (isCollapsed) return <div className="h-6" />;
  return (
    <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mt-6 mb-2 select-none">
      {children}
    </div>
  );
});

NavGroupLabel.displayName = "NavGroupLabel";

// ── Optimized NavDropdown (Collapsible submenu layout) ────────────────────
const NavDropdown = memo(({ 
  id, 
  icon: Icon, 
  label, 
  items, 
  activeDropdown, 
  setActiveDropdown, 
  isCollapsed 
}: { 
  id: string; 
  icon: any; 
  label: string; 
  items: any[]; 
  activeDropdown: string | null; 
  setActiveDropdown: (id: string | null) => void; 
  isCollapsed: boolean;
}) => {
  const isOpen = activeDropdown === id;
  
  // Jangan render dropdown jika tidak ada item yang boleh dilihat user
  const visibleItems = items.filter(i => i.show);
  if (visibleItems.length === 0) return null;

  const toggleDropdown = () => {
    // FIX: Do not expand sidebar when clicking collapsible menu in collapsed mode
    setActiveDropdown(isOpen ? null : id);
  };

  return (
    <div className="mb-1">
      <button
        onClick={toggleDropdown}
        title={isCollapsed ? label : undefined}
        className={cn(
          "w-full flex items-center px-3 py-2.5 my-1 rounded-lg transition-all duration-300 text-sm font-medium outline-none group", 
          isCollapsed ? "justify-center" : "gap-3",
          isOpen ? "bg-slate-800/50 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
        )}
      >
        <Icon className={cn("w-5 h-5 shrink-0 transition-colors", isOpen ? "text-primary" : "group-hover:text-slate-200")} />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate tracking-wide">{label}</span>
            <ChevronDown className={cn(
              "w-4 h-4 shrink-0 transition-transform duration-300", 
              isOpen ? "rotate-180 text-primary" : "text-slate-500 group-hover:text-slate-400"
            )} />
          </>
        )}
      </button>
      
      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100 mb-2" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className={cn(
            "space-y-1 py-1 transition-all duration-300",
            isCollapsed 
              ? "ml-0 pl-0 border-l-0 flex flex-col items-center" 
              : "ml-5 border-l-2 border-slate-800 pl-3"
          )}>
            {visibleItems.map((item) => (
              <NavLink 
                key={item.to} 
                to={item.to} 
                title={isCollapsed ? item.label : undefined}
                className={({isActive}) => cn(
                  "flex items-center transition-all duration-200 outline-none rounded-md py-2", 
                  isCollapsed 
                    ? "justify-center w-9 h-9" 
                    : "gap-2.5 px-3 w-full text-[13px]",
                  isActive 
                    ? "text-white font-semibold bg-primary/10 shadow-[inset_2px_0_0_0_rgba(59,130,246,1)]" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

NavDropdown.displayName = "NavDropdown";

export default function AppSidebar({ isMobile = false }: AppSidebarProps) {
  const location = useLocation();
  const { role, canView, isAdmin } = usePermissions();

  // 4. Manajemen State Dropdown yang Lebih Efisien
  // Menggunakan satu state untuk melacak dropdown mana yang sedang terbuka
  const [activeDropdown, setActiveDropdown] = useState<string | null>(() => {
    if (["/admin/products", "/admin/supplier", "/admin/inventory", "/admin/barcode"].some(p => location.pathname.startsWith(p))) return "inventory";
    if (["/admin/banner", "/admin/vouchers"].some(p => location.pathname.startsWith(p))) return "promo";
    return null;
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return false;
    return localStorage.getItem('mesenae_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('mesenae_sidebar_collapsed', String(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  // Update active dropdown jika route berubah via luar sidebar
  useEffect(() => {
    if (["/admin/products", "/admin/supplier", "/admin/inventory", "/admin/barcode"].some(p => location.pathname.startsWith(p))) {
      setActiveDropdown("inventory");
    } else if (["/admin/banner", "/admin/vouchers"].some(p => location.pathname.startsWith(p))) {
      setActiveDropdown("promo");
    } else {
       setActiveDropdown(null); // Optional: Tutup dropdown jika berpindah ke menu root
    }
  }, [location.pathname]);

  const storeSettingsList = useDbQuery<any>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  // 1. Optimalisasi Pemanggilan Database (Hook Redundancy)
  const transactions = useDbQuery<any>('transactions') || [];
  const { openBillsCount, processingCount } = useMemo(() => {
    let open = 0;
    let processing = 0;

    transactions.forEach((t: any) => {
      const isUnpaid = t.status === 'belum lunas';
      const isPaidButCooking = t.status === 'lunas' && t.kitchenStatus && !['diantarkan', 'selesai'].includes(t.kitchenStatus);
      
      if (isUnpaid || isPaidButCooking) open++;
      if (t.needsKitchen !== false && t.kitchenStatus && !['diantarkan', 'pending'].includes(t.kitchenStatus)) processing++;
    });

    return { openBillsCount: open, processingCount: processing };
  }, [transactions]);

  // 3. Sentralisasi Konfigurasi Route (Data-Driven Navigation)
  const MENU_CONFIG = [
    {
      group: "Operasional",
      show: canView('dashboard'),
      items: [
        { type: 'link', to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true, show: canView('dashboard') },
        { type: 'link', to: "/admin/cashier", icon: ShoppingCart, label: "Kasir (POS)", show: canView('cashier') },
        { type: 'link', to: "/admin/orders", icon: Clock, label: "Pesanan Aktif", badge: openBillsCount, urgentBadge: true, show: canView('activeOrders') },
        { type: 'link', to: "/admin/kitchen", icon: ChefHat, label: "Dapur (Kitchen)", badge: processingCount, urgentBadge: true, show: canView('kitchen') && storeSettings?.enableKitchen !== false },
        { type: 'link', to: "/admin/history", icon: History, label: "Riwayat Transaksi", show: canView('history') },
      ]
    },
    {
      group: "Manajemen",
      show: canView('products') || canView('categories') || canView('suppliers') || canView('stockIn') || canView('stockOut') || canView('marketing') || canView('tools') || canView('reports') || canView('settings') || canView('expenses') || canView('customers'),
      items: [
        {
          type: 'dropdown',
          id: 'inventory',
          icon: Package,
          label: "Inventori",
          show: canView('products') || canView('categories') || canView('suppliers') || canView('stockIn') || canView('stockOut'),
          subItems: [
            { to: "/admin/products", label: "Daftar Produk", icon: Package, show: canView('products') },
            { to: "/admin/inventory", label: "Manajemen Stok", icon: Boxes, show: canView('stockIn') || canView('stockOut') || canView('suppliers') },
            { to: "/admin/barcode", label: "Cetak Barcode", icon: Barcode, show: canView('tools') },
          ]
        },
        {
          type: 'dropdown',
          id: 'promo',
          icon: Ticket,
          label: "Promosi",
          show: canView('marketing'),
          subItems: [
            { to: "/admin/banner", label: "Banner Tampilan", icon: ImageIcon, show: true },
            { to: "/admin/vouchers", label: "Voucher Diskon", icon: Ticket, show: true },
          ]
        },
        { type: 'link', to: "/admin/qr-code", icon: QrCode, label: "QR Code Meja", show: canView('marketing') },
        { type: 'link', to: "/admin/expenses", icon: Wallet, label: "Pengeluaran", show: isAdmin || canView('expenses') },
        { type: 'link', to: "/admin/customers", icon: Users, label: "Data Pelanggan", show: isAdmin || canView('customers') },
        { type: 'link', to: "/admin/reports", icon: FileText, label: "Laporan Bisnis", show: canView('reports') },
        { type: 'link', to: "/admin/settings", icon: Settings, label: "Pengaturan Sistem", show: canView('settings') },
      ]
    }
  ];

  return (
    <div className={cn(
      "app-sidebar flex flex-col text-slate-200 shadow-2xl transition-all duration-300 ease-in-out relative z-20", 
      isMobile 
        ? "h-[100dvh] w-full m-0 rounded-none border-none bg-gradient-to-b from-[#0B1121] to-[#0F172A]" 
        : "h-screen m-0 rounded-none border-r border-slate-800/50 bg-[#0B1121]",
      isCollapsed && !isMobile ? "w-[80px]" : "w-[260px]"
    )}>
      {!isMobile && (
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3.5 top-9 bg-[#1E293B] border border-slate-700 text-slate-300 hover:text-white p-1 rounded-full shadow-lg z-30 transition-all duration-300 hover:scale-110 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {isCollapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
        </button>
      )}

      <div className={cn("flex items-center mt-7 mb-6 transition-all duration-300", isCollapsed ? "justify-center px-0" : "gap-3 px-6")}>
        <div className="w-11 h-11 bg-slate-800/80 backdrop-blur-md rounded-xl shrink-0 flex items-center justify-center shadow-lg border border-slate-700/50 p-1 relative overflow-hidden group">
          {storeSettings?.logo ? (
            <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-contain rounded-lg transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <img src="/icon-192.png" alt="MesenAe Logo" className="w-full h-full object-contain rounded-lg transition-transform duration-500 group-hover:scale-110" />
          )}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-extrabold text-base tracking-tight text-white truncate leading-tight">
              {storeSettings?.storeName || 'MesenAe POS'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[11px] font-medium text-slate-400 truncate">
                {role === 'admin' ? 'Administrator' : 'Staff'}
              </span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3.5 space-y-0.5 overflow-y-auto overflow-x-hidden pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        
        {/* Render Menu dari Konfigurasi */}
        {MENU_CONFIG.map((group, idx) => {
          if (!group.show) return null;

          return (
            <div key={idx}>
              <NavGroupLabel isCollapsed={isCollapsed}>{group.group}</NavGroupLabel>
              {group.items.map((item, itemIdx) => {
                if (!item.show) return null;

                if (item.type === 'link') {
                  return (
                    <NavItem 
                      key={itemIdx} 
                      to={item.to} 
                      exact={item.exact} 
                      icon={item.icon} 
                      label={item.label} 
                      badge={item.badge}
                      urgentBadge={item.urgentBadge}
                      isCollapsed={isCollapsed}
                      pathname={location.pathname}
                    />
                  );
                }

                if (item.type === 'dropdown') {
                  return (
                    <NavDropdown 
                      key={itemIdx}
                      id={item.id!}
                      icon={item.icon}
                      label={item.label!}
                      items={item.subItems!}
                      activeDropdown={activeDropdown}
                      setActiveDropdown={setActiveDropdown}
                      isCollapsed={isCollapsed}
                    />
                  );
                }
                
                return null;
              })}
            </div>
          );
        })}

      </nav>
      
      <div className="p-4 mt-auto border-t border-slate-800/50 bg-[#0B1121]">
        <button 
          onClick={() => {
            localStorage.removeItem('admin_auth');
            sessionStorage.removeItem('cashier_session_state');
            window.location.href = '/login';
          }}
          title={isCollapsed ? "Keluar Aplikasi" : undefined}
          className={cn(
            "w-full flex items-center justify-center p-2.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-medium transition-all duration-300 group", 
            !isCollapsed && "gap-3"
          )}
        >
          <LogOut size={18} className="group-hover:scale-110 transition-transform duration-300" />
          {!isCollapsed && <span className="text-sm tracking-wide">Keluar</span>}
        </button>
      </div>
    </div>
  );
}
