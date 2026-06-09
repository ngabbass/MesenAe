import React, { useState } from 'react';
import { Section, SettingCard, SettingRow } from '../Settings';
import { cn } from '@/lib/utils';
import { useDbQuery, type StoreSettings } from '@/hooks/db-hooks';

// --- Icons ---
import { 
  Store, 
  Smartphone, 
  ChefHat, 
  CreditCard, 
  Ticket, 
  Package, 
  Printer, 
  Palette, 
  Cloud, 
  Wifi,
  BookOpen,
  ShoppingCart,
  CupSoda,
  Tag,
  MapPin,
  BarChart3,
  Zap,
  CheckCircle2,
  Layers,
  ShieldCheck,
  LayoutDashboard,
  ChevronDown,
  User,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';

/* ============================================================================
   SUB-COMPONENTS INTERAKTIF
============================================================================ */

/**
 * Item Fitur Interaktif (Ikon membesar, border muncul saat di-hover)
 */
function FeatureItem({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl hover:bg-card transition-all duration-300 border border-transparent hover:border-border/60 hover:shadow-sm cursor-default">
      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h4 className="text-[13px] font-bold text-foreground transition-colors group-hover:text-primary">{title}</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/**
 * Item Keunggulan Interaktif (Bergeser ke kanan saat di-hover)
 */
function AdvantageItem({ text }: { text: string }) {
  return (
    <div className="group flex items-center gap-2.5 p-2 -ml-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all duration-300 cursor-default">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 transition-transform duration-300 group-hover:scale-110" />
      <span className="text-[12px] font-medium text-foreground/80 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground">
        {text}
      </span>
    </div>
  );
}

/**
 * Komponen SISTEM COLLAPSE (Buka-Tutup) yang halus dan profesional
 */
function CollapsibleModule({ 
  title, 
  subtitle, 
  icon: Icon, 
  defaultOpen = false, 
  children 
}: { 
  title: string, 
  subtitle: string, 
  icon: any, 
  defaultOpen?: boolean, 
  children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <SettingCard className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md group/card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-secondary/40 transition-colors outline-none group/btn"
      >
        <div className="flex items-center gap-4 text-left">
          <div className={cn(
            "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
            isOpen 
              ? "bg-primary text-primary-foreground border-primary/20 shadow-sm" 
              : "bg-primary/10 text-primary border-primary/20 group-hover/btn:bg-primary/20 group-hover/btn:scale-105"
          )}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="text-[14px] sm:text-[15px] font-bold text-foreground group-hover/btn:text-primary transition-colors">{title}</h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border",
          isOpen 
            ? "rotate-180 bg-primary/10 text-primary border-primary/20" 
            : "bg-background text-muted-foreground border-border/50 group-hover/btn:bg-primary/10 group-hover/btn:text-primary group-hover:border-primary/20"
        )}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      
      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="border-t border-border/50 bg-background/50">
            {children}
          </div>
        </div>
      </div>
    </SettingCard>
  );
}

/* ============================================================================
   MAIN COMPONENT: AboutTab
============================================================================ */

export default function AboutTab() {
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  const customerUrl = storeSettings?.customerUrl;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      
      {/* ────────────────────────────────────────────────────────────────────────
          BAGIAN 1: HEADER APLIKASI & DEVELOPER
      ───────────────────────────────────────────────────────────────────────── */}
      <Section hideHeader title="Informasi Sistem">
        <SettingCard className="border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-4 p-5 border-b border-border/50 bg-gradient-to-br from-card to-primary/5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-border/50 shadow-sm flex items-center justify-center shrink-0 hover:scale-105 transition-transform duration-300">
              <img 
                src="/icon-192.png" 
                alt="MesenAe Logo" 
                className="w-full h-full object-contain p-2" 
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} 
              />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground flex items-center gap-1.5">
                MesenAe
              </h3>
              <p className="text-[12px] sm:text-[13px] font-medium text-muted-foreground mt-0.5">
                Sistem POS & Self-Ordering Modern 🇮🇩
              </p>
              <div className="mt-2.5">
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md uppercase tracking-wider border border-primary/20 shadow-sm">
                  Versi 1.0.0
                </span>
              </div>
            </div>
          </div>
          
          <SettingRow last label="Pengembang">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 hover:bg-primary/5 rounded-lg border border-border/50 transition-colors cursor-default">
              <User className="w-4 h-4 text-primary" />
              <span className="text-[12px] sm:text-[13px] font-bold text-foreground">
                Ahmad Abdul Basith, S.Tr.I.P.
              </span>
            </div>
          </SettingRow>
        </SettingCard>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────────
          BAGIAN 2: MODUL EKOSISTEM (COLLAPSIBLE)
      ───────────────────────────────────────────────────────────────────────── */}
      <Section title="Modul Ekosistem Terintegrasi" description="Klik panel untuk mengeksplorasi fitur sistem.">
        
        {/* === MODULE 1: CLOUD POS === */}
        <CollapsibleModule 
          title="MesenAe Workspace" 
          subtitle="Sentralisasi Kasir & Manajemen Bisnis F&B" 
          icon={Store}
          defaultOpen={true}
        >
          {/* Ringkasan Efektif */}
          <div className="p-5 border-b border-border/50 bg-card">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Solusi kasir cerdas</strong> yang menyatukan pesanan, pembayaran, dan dapur dalam satu layar. Memangkas waktu tunggu pelanggan dan menyederhanakan manajemen operasional outlet Anda secara real-time.
            </p>
          </div>

          <div className="bg-secondary/20 p-5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Kapabilitas Inti
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <FeatureItem icon={Store} title="Point Of Sale Terpadu" description="Satu layar untuk semua transaksi kasir." />
              <FeatureItem icon={ChefHat} title="KDS (Layar Dapur)" description="Tiket pesanan nirkabel langsung ke dapur." />
              <FeatureItem icon={CreditCard} title="Pembayaran Digital" description="Terima semua pembayaran digital instan & aman." />
              <FeatureItem icon={Ticket} title="Manajemen Diskon" description="Atur promo & voucher dengan mudah." />
              <FeatureItem icon={Package} title="Katalog Cerdas" description="Kelola stok, varian, & kategori menu." />
              <FeatureItem icon={Printer} title="Cetak Otomatis" description="Cetak struk thermal & resi digital." />
            </div>
          </div>
        </CollapsibleModule>

        {/* === MODULE 2: SELF ORDER === */}
        <CollapsibleModule 
          title="MesenAe Self Order" 
          subtitle="Pemesanan Mandiri via QR Code" 
          icon={Smartphone}
        >
          <div className="p-5 border-b border-border/50 bg-card relative">
            <p className="text-[13px] leading-relaxed text-muted-foreground relative z-10">
              <strong className="text-foreground">Tanpa antre, tanpa unduh aplikasi.</strong> Pelanggan cukup pindai QR Code di meja untuk mengeksplorasi menu, memilih varian, dan melacak pesanan secara langsung dari HP mereka.
            </p>
          </div>

          <div className="bg-secondary/20 p-5 border-b border-border/50">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-primary" /> Pengalaman Pelanggan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              <FeatureItem icon={BookOpen} title="Buku Menu Digital" description="Katalog visual yang memanjakan mata." />
              <FeatureItem icon={ShoppingCart} title="Pesan Mandiri" description="Atur keranjang belanja tanpa bantuan pramusaji." />
              <FeatureItem icon={CupSoda} title="Kustomisasi Bebas" description="Pilih opsi es, gula, dan aneka topping." />
              <FeatureItem icon={Zap} title="Live Tracking" description="Pantau status pesanan hingga dihidangkan." />
            </div>
          </div>

          {/* Keunggulan & Ekosistem Interaktif */}
          <div className="p-5 flex flex-col lg:flex-row gap-6 bg-card">
            
            {/* Keunggulan */}
            <div className="flex-1">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Benefit Bisnis
              </h4>
              <div className="space-y-1">
                <AdvantageItem text="Percepat rotasi meja (Table Turnover)" />
                <AdvantageItem text="Bebaskan antrean panjang di kasir" />
                <AdvantageItem text="Hapus risiko salah catat (Human Error)" />
                <AdvantageItem text="Tingkatkan nilai transaksi via Upselling visual" />
              </div>
            </div>

            {/* Siklus Ekosistem Interaktif */}
            <div className="flex-1 bg-secondary/30 rounded-xl border border-border/60 p-5 hover:bg-secondary/50 transition-colors">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-5 text-center flex items-center justify-center gap-2">
                Alur Integrasi Real-Time
              </h4>
              
              <div className="space-y-4 relative px-2">
                {/* Garis konektor yang rapi */}
                <div className="absolute left-[22px] top-4 bottom-4 w-0.5 bg-border rounded-full"></div>
                
                <div className="group relative z-10 flex items-center gap-4 cursor-default">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 shadow-sm border border-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <p className="text-[12px] font-bold text-foreground group-hover:text-blue-500 transition-colors">1. Pelanggan Memesan</p>
                </div>
                
                <div className="group relative z-10 flex items-center gap-4 cursor-default">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm border border-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                    <Store className="w-4 h-4" />
                  </div>
                  <p className="text-[12px] font-bold text-foreground group-hover:text-primary transition-colors">2. Kasir Konfirmasi</p>
                </div>
                
                <div className="group relative z-10 flex items-center gap-4 cursor-default">
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 shadow-sm border border-rose-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <p className="text-[12px] font-bold text-foreground group-hover:text-rose-500 transition-colors">3. Dapur Menyiapkan</p>
                </div>
              </div>
            </div>
            
          </div>

          {/* Web Selforder Button */}
          {customerUrl && (
            <div className="px-5 pb-5 pt-3 bg-card border-t border-border/30 flex items-center justify-between gap-4">
              <span className="text-[11px] text-muted-foreground leading-normal">
                Akses cepat ke website pemesanan pelanggan (Self-Order).
              </span>
              <a
                href={customerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-bold rounded-xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 active:scale-95 shrink-0"
              >
                Web Selforder <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </CollapsibleModule>

      </Section>

      {/* ────────────────────────────────────────────────────────────────────────
          BAGIAN 3: HUBUNGI DEVELOPER (WHATSAPP)
      ───────────────────────────────────────────────────────────────────────── */}
      <Section title="Pusat Bantuan">
        <SettingCard className="border-emerald-200 dark:border-emerald-900/40 shadow-sm overflow-hidden bg-emerald-50/40 dark:bg-emerald-950/20 group hover:shadow-md transition-shadow duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[14px] sm:text-[15px] font-bold text-foreground">Hubungi Developer</h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Dukungan teknis, laporan bug, atau masukan fitur.
                </p>
              </div>
            </div>
            
            <a
              href="https://wa.me/6285159686554"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold rounded-xl shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 outline-none focus-visible:ring-2 ring-emerald-500 ring-offset-2 w-full sm:w-auto active:scale-95"
            >
              Chat WhatsApp <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </SettingCard>
      </Section>

    </div>
  );
}
