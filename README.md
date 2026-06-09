# 🧾 Mesen.Ae - Premium Cloud POS & Smart Ordering System

<p align="center">
  <strong>Platform Point of Sale (POS), Self-Ordering, dan Manajemen Restoran Kelas Atas Berbasis Cloud & PWA.</strong><br>
  <em>Solusi Digital End-to-End dengan Real-time Sync, Offline Resilience, dan Sistem Caching Mutakhir.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge" alt="Production Ready" />
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20PWA-orange?style=for-the-badge" alt="PWA Platform" />
  <img src="https://img.shields.io/badge/Database-Firebase%20Firestore-blue?style=for-the-badge" alt="Firebase Firestore" />
  <img src="https://img.shields.io/badge/Storage-Cloudinary%20API-yellow?style=for-the-badge" alt="Cloudinary Storage" />
  <img src="https://img.shields.io/badge/Architecture-Real--time%20Sync-purple?style=for-the-badge" alt="Real-time Sync" />
</p>

---

## 🌟 Ringkasan Eksekutif (Executive Summary)

**Mesen.Ae** adalah ekosistem Point of Sale (POS) dan Self-Ordering mutakhir yang dirancang khusus untuk memodernisasi operasional F&B (Kafe, Restoran, dan UMKM). 

Beranjak dari aplikasi kasir konvensional, Mesen.Ae menghadirkan arsitektur **Cloud-Native** terdistribusi yang menghubungkan Admin (Kasir), Dapur (Kitchen Display System), dan Pelanggan (Customer Self-Order) secara real-time tanpa latensi yang berarti. Aplikasi ini dirancang agar ringan, cepat, dan tetap tangguh (*resilient*) bahkan dalam kondisi koneksi internet yang tidak stabil.

---

## ⚡ Arsitektur Caching & Real-time Synchronization

Kunci utama kecepatan Mesen.Ae terletak pada kombinasi **TanStack React Query** dan **Firebase Real-time Listeners (onSnapshot)** yang membentuk infrastruktur data responsif dan hemat biaya:

1. **Zero Latency UI Updates (Optimistic Updates)**  
   Aksi kritis seperti menambahkan pesanan atau mengubah status pembayaran langsung diperbarui di layar antarmuka pengguna secara instan (*Optimistic UI*), sembari sistem melakukan sinkronisasi latar belakang ke server.
   
2. **Intelligent Local Caching (Offline Resilience)**  
   React Query menyimpan *cache* lokal cerdas. Perpindahan antar menu atau halaman terjadi dalam 0 milidetik tanpa kedipan *loader* (*zero visual flash*). Jika koneksi terputus, aplikasi tetap responsif membaca data dari *cache* lokal.

3. **Real-time Push Synchronization**  
   Perubahan sekecil apapun di sisi Pelanggan atau Kasir akan di-push otomatis oleh Firestore dalam hitungan milidetik. Dapur akan langsung menerima notifikasi pesanan masuk tanpa perlu melakukan mekanisme *pulling/refresh* halaman secara manual.

4. **Optimasi Biaya Firebase (Cost-Effective Reads)**  
   Sistem caching sangat efisien dalam meminimalkan jumlah *reads* ke Firestore. Data yang tidak berubah akan dilayani langsung dari memori *browser*, mencegah pembengkakan biaya *database*.

---

## ✨ Fitur Unggulan Sistem (Key Features)

### 🏪 1. Modul Kasir & Manajemen Order Lanjutan
*   **Split Bill & Cicilan:** Fleksibilitas pembayaran di mana satu meja dapat dibayar secara terpisah, dicicil bertahap, atau digabungkan (*merge*).
*   **Open Bill & Hold Order:** Kemampuan menahan pesanan pelanggan untuk diselesaikan kemudian tanpa mengganggu antrean kasir.
*   **Multi-Variant & Add-on Engine:** Sistem kustomisasi pesanan mendalam (contoh: *Sugar Level*, *Ice Level*, Ekstra Topping). Mendukung wajib/opsional dan *single/multiple choice* dengan kalkulasi harga otomatis.
*   **Manajemen Voucher:** Terapkan diskon manual (nominal/persentase) atau scan voucher belanja dengan validasi cerdas secara real-time.

### 💳 2. Ekosistem Pembayaran Digital Terpadu
*   **Midtrans Payment Gateway:** Dukungan instan untuk pembayaran via e-Wallet (GoPay, OVO, ShopeePay), transfer Virtual Account Bank, dan QRIS Dinamis.
*   **Smart QRIS Validation:** Status transaksi QRIS/Bank diperbarui secara otomatis *(webhook auto-sync)* dari server ke layar kasir tanpa perlu verifikasi manual.
*   **Multi-Tender Payments:** Kombinasi pembayaran tunai dan digital dalam satu tagihan (*split payment*).

### 🎨 3. Studio Banner Promosi Visual (Pro Editor)
*   **Drag & Drop Visual Engine:** Admin dapat mendesain *banner* promosi toko layaknya menggunakan software desain profesional langsung di peramban.
*   **Multi-Layering & Overlays:** Mendukung penumpukan (*stacking*) beberapa stiker/gambar produk (hingga 3 overlay) pada satu kanvas banner.
*   **Magic Wand (AI-like Background Remover):** Alat *crop* dan hapus latar belakang interaktif terintegrasi yang mendukung *pan* (geser) dan *zoom* menggunakan tetikus.
*   **Smart Auto-Sync Preview:** Apa yang didesain di Editor Admin dijamin 100% presisi (ukuran, rasio, rotasi, efek *blur/brightness*) dengan yang tampil di aplikasi *Customer*.

### 📦 4. Manajemen Media & Efisiensi Penyimpanan
*   **Web Worker Image Compression:** Menggunakan *thread* latar belakang *browser* (Web Worker) untuk mengompresi ukuran foto produk/logo hingga < 300KB sebelum diunggah. Menjamin *UI* tidak membeku (*freeze*) selama proses pemampatan.
*   **Cloudinary Integration:** Foto dan *banner* dilayani lewat CDN Cloudinary yang dilengkapi transformasi otomatis (*auto-format, auto-quality*).
*   **Orphan Media Auto-Cleanup:** Sistem akan membuang file media lama di *cloud* secara otomatis saat pengguna mengganti/menghapus gambar untuk menghindari pemborosan ruang penyimpanan.

### 🖨️ 5. Rekapitulasi & Output (Cetak & Digital)
*   **Integrasi Printer Thermal Thermal:** Pencetakan struk nirkabel (Bluetooth) maupun kabel (USB) dengan format teks yang rapi, lengkap dengan kustomisasi Header & Footer Toko.
*   **E-Receipt & WhatsApp Integration:** Konversi struk tagihan ke dalam format dokumen PDF cantik yang bisa dibagikan langsung ke WhatsApp pelanggan dalam satu ketukan.
*   **Dynamic High-Res Logo:** Logo toko dicetak dalam resolusi tajam di dokumen PDF dan beradaptasi secara dinamis (Mode Gelap/Terang) di dalam aplikasi.

### 📱 6. Progressive Web App (PWA) & Native-like UI
*   **Premium Glassmorphism Design:** Antarmuka modern yang memanjakan mata dengan dukungan Mode Gelap (*Dark Mode*) yang komprehensif, memanfaatkan Tailwind CSS dan shadcn/ui.
*   **Installable App:** Aplikasi dapat diinstal ke *Homescreen* iOS/Android dan berjalan dalam mode layar penuh (*standalone*) layaknya aplikasi *Native*.
*   **Kitchen Display System (KDS):** Layar khusus untuk dapur yang merender antrean masakan secara *real-time* berbasis *Grid/Carousel*, sehingga operasional memasak jauh lebih efisien.

---

## 🛠️ Stack Teknologi & Perangkat Lunak

Aplikasi dibangun dari nol dengan validasi ketat, mengeliminasi *dead-code*, dan hanya menggunakan pustaka modern berkinerja tinggi:

*   **Frontend Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite 8](https://vite.dev/)
*   **UI/UX & Styling:** Vanilla CSS + [Tailwind CSS 3](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Premium UI Components)
*   **State & Caching Management:** [TanStack React Query 5](https://tanstack.com/query/latest) & Zustand
*   **Real-time Database:** [Firebase SDK v10+](https://firebase.google.com/) (Cloud Firestore)
*   **Media Storage & CDN:** Cloudinary API & Firebase Storage
*   **Payment Gateway:** Midtrans Snap API
*   **Ikonografi & Periferal:** Lucide React & html5-qrcode (Barcode/QR Scanner)

---

## 📂 Struktur Repositori & Arsitektur Direktori

```text
MesenAe/
├── src/
│   ├── admin/              # Panel Utama Administrasi, Editor Banner & Manajemen Stok
│   ├── kitchen/            # Modul Layar Dapur (KDS) Real-time
│   ├── login/              # Portal Autentikasi Keamanan Sentral
│   ├── components/         # Komponen UI Reusable (Tombol, Modal, Banner)
│   ├── hooks/              # Custom React Hooks & Abstraksi Kueri Firestore (db-hooks.ts)
│   ├── lib/                # Konfigurasi Utilitas (Firebase Config, Cloudinary, Midtrans)
│   ├── App.tsx             # Entry Point & Definisi Router Navigasi
│   └── index.css           # Token CSS Global, Tailwind Directives, & Tema Warna
├── public/                 # Aset Publik Statis (Logo, Service Worker, Manifest PWA)
├── vite.config.ts          # Konfigurasi PWA Vite Plugin & Modul Bundler
└── package.json            # Manajemen Pustaka Node.js
```

> [!NOTE]
> **Arsitektur Decoupled (Terdistribusi):** Antarmuka **Self-Ordering Pelanggan (Customer App)** dipisahkan secara struktural dari aplikasi Kasir/Admin untuk mengisolasi beban kerja (workload), meminimalisasi kerentanan keamanan, serta mempercepat waktu pemuatan *(Time to Interactive)* bagi pelanggan.

---

## 📊 Skema Database (NoSQL - Firestore Collections)

*   **`store_settings`**: Menyimpan metadata toko (nama, alamat, teks struk thermal, mode operasional, palet warna kustom, konfigurasi integrasi).
*   **`categories` & `products`**: Inventaris menu, harga (HPP & Jual), stok, link gambar CDN, dan relasi varian kustom (topping).
*   **`transactions` & `transaction_items`**: Rekam jejak pesanan, pembaruan status dapur (antre/dimasak/selesai), dan riwayat penyelesaian pembayaran (Split/Full).
*   **`banners`**: Penyimpanan objek vektor dan raster kustom hasil dari *Promo Banner Editor* (posisi X/Y, scale, blending mode).
*   **`vouchers`**: Aturan promosi dan potongan diskon dengan parameter tenggat waktu dan limit penggunaan.
*   **`stock_ins`, `stock_outs`, & `hpp_history`**: Sistem pencatatan log pergerakan stok dan fluktuasi Harga Pokok Penjualan secara akuntabel.

---

## 🚀 Panduan Deployment & Instalasi

Buat file `.env` di direktori utama proyek Anda untuk konfigurasi lingkungan:

```bash
# FIREBASE CLOUD CONFIGURATION
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# CLOUDINARY MEDIA CDN
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_API_KEY=your_api_key
VITE_CLOUDINARY_API_SECRET=your_api_secret

# MIDTRANS PAYMENT GATEWAY
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-your_client_key_here
MIDTRANS_SERVER_KEY=SB-Mid-server-your_server_key_here
MIDTRANS_IS_PRODUCTION=false # Set 'true' untuk mode produksi nyata
```

Langkah-langkah menjalankan secara lokal:

1. **Instalasi Dependencies:** `npm install`
2. **Jalankan Development Server:** `npm run dev` (Akses melalui `http://localhost:5173`)
3. **Compile for Production:** `npm run build`

---

## 🔒 Lisensi & Hak Cipta

**MIT License** — Hak Cipta © 2026 **Ahmad Basith**.  
Penggunaan, modifikasi, dan distribusi sistem perangkat lunak ini tunduk pada syarat dan ketentuan yang diatur di bawah lisensi MIT. Dibangun dengan fokus penuh terhadap performa, kebersihan kode (*clean code*), dan pemberdayaan ekosistem F&B digital.
