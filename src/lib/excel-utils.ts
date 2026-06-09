import * as XLSX from 'xlsx-js-style';
import { type Product } from '@/hooks/db-hooks';
import { toast } from 'sonner';
import { dbAdmin as db } from './db';
import { mapProduct, mapCategory, mapSupplier, mapTransaction, mapPaymentMethod, mapStockIn, mapStockOut } from './sync';

// ─── Constants ────────────────────────────────────────────────────────────────
const HEADER_BG   = 'FF1D4ED8'; // blue-700
const HEADER_FG   = 'FFFFFFFF'; // white
const WRITE_OPTS  = { bookType: 'xlsx' as const, cellStyles: true };

// ─── Apply styled header row ──────────────────────────────────────────────────
function applyHeaderStyle(ws: XLSX.WorkSheet, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
      font: { bold: true, color: { rgb: HEADER_FG }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'medium', color: { rgb: 'FF93C5FD' } } },
    };
  }
  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
}

// ─── Template Download ────────────────────────────────────────────────────────
export async function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Produk ──
  const prodHeaders = ['ID', 'Nama Produk', 'SKU', 'ID Kategori', 'Harga Jual', 'HPP', 'Stok', 'Satuan', 'Varian', 'Foto', 'Barcode', 'Dibuat Pada', 'Diperbarui Pada'];
  const prodExamples = [
    ['', 'Nasi Goreng Spesial', 'NGS001', '1', 15000, 8000, 50, 'porsi', '', '', '', '', ''],
    ['', 'Es Teh Manis', 'ETM001', '2', 5000, 2000, 100, 'cup', '', '', '', '', ''],
    ['', 'Keripik Singkong', 'KS001', '4', 8000, 4000, 30, 'bungkus', '', '', '8991234567890', '', ''],
  ];
  const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodExamples]);
  wsProd['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];
  applyHeaderStyle(wsProd, prodHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsProd, 'Produk');

  // ── Sheet 2: Kategori (Sebagai Referensi ID) ──
  const catHeaders = ['ID', 'Nama Kategori', 'Warna', 'Ikon', 'Dibuat Pada'];
  const catExamples = [
    ['1', 'Makanan', '#FF6B35', '🍕', ''],
    ['2', 'Minuman', '#4ECDC4', '🥤', ''],
    ['3', 'Rokok & Tembakau', '#6B7280', '🚬', ''],
    ['4', 'Snack', '#F59E0B', '🍿', ''],
  ];
  const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catExamples]);
  wsCat['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 25 }];
  applyHeaderStyle(wsCat, catHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Kategori');

  // ── Sheet 3: Panduan ──
  const panduanData: (string | number)[][] = [
    ['📋 PANDUAN LENGKAP IMPORT DATA MESENAE'],
    [''],
    ['═══════════════════════════════════════════════════════════════'],
    ['SHEET "PRODUK" — Kolom yang tersedia:'],
    ['═══════════════════════════════════════════════════════════════'],
    ['Kolom', 'Keterangan', 'Wajib?', 'Contoh'],
    ['Nama Produk', 'Nama lengkap produk yang akan ditampilkan di kasir', 'YA ✅', 'Nasi Goreng Spesial'],
    ['SKU', 'Kode unik produk. Tidak boleh sama antar produk.', 'YA ✅', 'NGS001'],
    ['Kategori', 'Nama kategori HARUS SAMA PERSIS dengan yang ada di aplikasi', 'YA ✅', 'Makanan'],
    ['Harga Jual', 'Harga jual ke pelanggan. Isi angka saja tanpa titik/koma/Rp.', 'YA ✅', 15000],
    ['HPP', 'Harga Pokok Penjualan / harga beli. Boleh kosong (default 0).', 'Tidak', 8000],
    ['Stok Awal', 'Jumlah stok awal saat import. Boleh kosong (default 0).', 'Tidak', 50],
    ['Satuan', 'Satuan produk: pcs / kg / gram / liter / ml / porsi / cup / botol / bungkus', 'Tidak', 'porsi'],
    ['Barcode', 'Kode barcode produk (EAN-13, dll). Boleh kosong.', 'Tidak', '8991234567890'],
    [''],
    ['═══════════════════════════════════════════════════════════════'],
    ['ATURAN PENTING SEBELUM IMPORT:'],
    ['═══════════════════════════════════════════════════════════════'],
    ['1. Jangan hapus atau ubah baris HEADER (baris pertama berwarna biru)'],
    ['2. Hapus baris CONTOH sebelum import (baris 2 ke bawah yang berisi data contoh)'],
    ['3. SKU yang sudah ada di aplikasi akan DILEWATI (tidak duplikat)'],
    ['4. SKU duplikat dalam satu file juga akan dilewati'],
    ['5. Baris yang kosong sepenuhnya akan diabaikan otomatis'],
    ['6. Format file yang didukung: .xlsx, .xls, .csv'],
    ['7. Pastikan angka tidak mengandung format mata uang (Rp, titik ribuan, dll)'],
    [''],
    ['═══════════════════════════════════════════════════════════════'],
    ['CARA IMPORT:'],
    ['═══════════════════════════════════════════════════════════════'],
    ['1. Isi data produk di sheet "Produk" (hapus baris contoh terlebih dahulu)'],
    ['2. Simpan file dalam format .xlsx'],
    ['3. Buka aplikasi MesenAe → Pengaturan → Import / Export Excel'],
    ['4. Klik "Import Produk dari Excel"'],
    ['5. Pilih file yang sudah diisi'],
    ['6. Tunggu proses selesai dan lihat notifikasi hasilnya'],
    [''],
    ['Dibuat oleh: MesenAe — Aplikasi Kasir UMKM 🇮🇩'],
  ];
  const wsPanduan = XLSX.utils.aoa_to_sheet(panduanData);
  wsPanduan['!cols'] = [{ wch: 22 }, { wch: 60 }, { wch: 10 }, { wch: 25 }];
  if (wsPanduan['A1']) {
    wsPanduan['A1'].s = {
      font: { bold: true, sz: 14, color: { rgb: HEADER_BG } },
    };
  }
  XLSX.utils.book_append_sheet(wb, wsPanduan, 'Panduan');

  XLSX.writeFile(wb, 'template-import-produk-mesenae.xlsx', WRITE_OPTS);
  toast.success('Template berhasil diunduh');
}

// ─── Import Products from Excel ───────────────────────────────────────────────
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importProductsFromExcel(file: File): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) {
    result.errors.push('File kosong atau tidak ada data selain header');
    return result;
  }

  const header = (rows[0] as string[]).map(h => String(h).trim().toLowerCase());

  const colIndex = (names: string[]): number => {
    for (const n of names) {
      const idx = header.findIndex(h => h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iNama    = colIndex(['nama produk', 'nama', 'product name']);
  const iSku     = colIndex(['sku']);
  const iKat     = colIndex(['kategori', 'category']);
  const iHarga   = colIndex(['harga jual', 'harga', 'price', 'selling']);
  const iHpp     = colIndex(['hpp', 'harga pokok', 'cost']);
  const iStok    = colIndex(['stok awal', 'stok', 'stock']);
  const iSatuan  = colIndex(['satuan', 'unit']);
  const iBarcode = colIndex(['barcode']);

  if (iNama === -1 || iSku === -1) {
    result.errors.push('Kolom "Nama Produk" dan "SKU" wajib ada di header');
    return result;
  }

  const [{ data: cats }, { data: prods }] = await Promise.all([
    db.from('categories').select('*'),
    db.from('products').select('*')
  ]);

  const categories = cats?.map(mapCategory) || [];
  const existingProducts = prods?.map(mapProduct) || [];

  const existingMap = new Map<string, Product>();
  existingProducts.forEach(p => existingMap.set(p.sku.toLowerCase(), p));

  const VALID_UNITS = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
  const toAdd: any[] = [];
  const toUpdate: { id: string | number, changes: any }[] = [];
  const skusSeen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as any[];
    const rowNum = i + 1;

    const namaProduk = String(row[iNama] ?? '').trim();
    const skuRaw     = String(row[iSku] ?? '').trim();

    if (!namaProduk && !skuRaw) continue;

    if (!namaProduk) {
      result.errors.push(`Baris ${rowNum}: Nama Produk kosong`);
      result.skipped++; continue;
    }
    if (!skuRaw) {
      result.errors.push(`Baris ${rowNum}: SKU kosong untuk "${namaProduk}"`);
      result.skipped++; continue;
    }

    const skuLower = skuRaw.toLowerCase();

    if (skusSeen.has(skuLower)) {
      result.errors.push(`Baris ${rowNum}: SKU "${skuRaw}" duplikat dalam file, dilewati`);
      result.skipped++; continue;
    }

    let resolvedCategoryId = categories[0]?.id ?? 0;
    if (iKat !== -1) {
      const katVal = String(row[iKat] ?? '').trim();
      
      // Jika ID angka
      if (!isNaN(Number(katVal))) {
        resolvedCategoryId = Number(katVal);
      } else {
        // Jika pakai Nama
        const found = categories.find(c => c.name.toLowerCase() === katVal.toLowerCase());
        if (found) resolvedCategoryId = found.id!;
        else if (katVal) result.errors.push(`Baris ${rowNum}: Kategori "${row[iKat]}" tidak ditemukan, pakai kategori pertama`);
      }
    }

    const hargaJual = iHarga !== -1 ? Number(row[iHarga]) || 0 : 0;
    const hppVal    = iHpp !== -1   ? Number(row[iHpp])   || 0 : 0;
    const stokAwal  = iStok !== -1  ? Number(row[iStok])  || 0 : 0;

    let satuanVal = 'pcs';
    if (iSatuan !== -1) {
      const s = String(row[iSatuan] ?? '').trim().toLowerCase();
      satuanVal = VALID_UNITS.includes(s) ? s : 'pcs';
    }

    const barcodeVal = iBarcode !== -1 ? String(row[iBarcode] ?? '').trim() : '';

    skusSeen.add(skuLower);

    if (existingMap.has(skuLower)) {
      const existing = existingMap.get(skuLower)!;
      toUpdate.push({
        id: existing.id!,
        changes: {
          name: namaProduk,
          category_id: resolvedCategoryId !== 0 ? resolvedCategoryId : existing.categoryId,
          price: iHarga !== -1 ? hargaJual : existing.price,
          hpp: iHpp !== -1 ? hppVal : existing.hpp,
          stock: iStok !== -1 ? stokAwal : existing.stock,
          unit: iSatuan !== -1 ? satuanVal : existing.unit,
          barcode: iBarcode !== -1 ? barcodeVal : existing.barcode,
          updated_at: new Date().toISOString()
        }
      });
    } else {
      toAdd.push({
        name: namaProduk, sku: skuRaw,
        category_id: resolvedCategoryId,
        price: hargaJual, hpp: hppVal, stock: stokAwal,
        unit: satuanVal, barcode: barcodeVal || undefined,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
    }
  }

  if (toAdd.length > 0) {
    await db.from('products').insert(toAdd);
    result.imported += toAdd.length;
  }
  
  if (toUpdate.length > 0) {
    for (const update of toUpdate) {
      await db.from('products').update(update.changes).eq('id', update.id);
    }
    result.imported += toUpdate.length;
  }

  return result;
}

// ─── Export all data to Excel (multi-sheet, blue header) ──────────────────────
export async function exportAllDataToExcel() {
  const wb = XLSX.utils.book_new();

  const [{ data: p }, { data: c }, { data: s }, { data: si }, { data: so }, { data: tx }, { data: pm }] = await Promise.all([
    db.from('products').select('*'),
    db.from('categories').select('*'),
    db.from('suppliers').select('*'),
    db.from('stock_ins').select('*').order('date', { ascending: false }),
    db.from('stock_outs').select('*').order('date', { ascending: false }),
    db.from('transactions').select('*').order('date', { ascending: false }),
    db.from('payment_methods').select('*'),
  ]);

  const products = p?.map(mapProduct) || [];
  const categories = c?.map(mapCategory) || [];
  const suppliers = s?.map(mapSupplier) || [];
  const stockIns = si?.map(mapStockIn) || [];
  const stockOuts = so?.map(mapStockOut) || [];
  const transactions = tx?.map(mapTransaction) || [];
  const paymentMethods = pm?.map(mapPaymentMethod) || [];

  const catMap = new Map(categories.map(cat => [cat.id!, cat.name]));

  // ── Products ──
  const prodHeaders = ['ID', 'Nama Produk', 'SKU', 'ID Kategori', 'Harga Jual', 'HPP', 'Stok', 'Satuan', 'Varian', 'Foto', 'Barcode', 'Dibuat Pada', 'Diperbarui Pada'];
  const wsProd = XLSX.utils.aoa_to_sheet([
    prodHeaders,
    ...products.map(p => [
      p.id, p.name, p.sku, p.categoryId, p.price, p.hpp, p.stock, p.unit, 
      p.variants ? JSON.stringify(p.variants) : '', 
      p.photo ?? '', 
      p.barcode ?? '', 
      '', '' // Tanggal dilewati biar gampang import ulang
    ]),
  ]);
  wsProd['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];
  applyHeaderStyle(wsProd, prodHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsProd, 'products');

  // ── Categories ──
  const catHeaders = ['ID', 'Nama Kategori', 'Warna', 'Ikon', 'Dibuat Pada'];
  const wsCat = XLSX.utils.aoa_to_sheet([
    catHeaders, 
    ...categories.map(cat => [cat.id, cat.name, cat.color, cat.icon, ''])
  ]);
  wsCat['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 25 }];
  applyHeaderStyle(wsCat, catHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsCat, 'categories');

  // ── Suppliers ──
  const supHeaders = ['ID', 'Nama Pemasok', 'No. HP', 'Alamat', 'Catatan', 'Dibuat Pada'];
  const wsSup = XLSX.utils.aoa_to_sheet([
    supHeaders, 
    ...suppliers.map(sup => [sup.id, sup.name, sup.phone, sup.address, sup.notes, ''])
  ]);
  wsSup['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 25 }];
  applyHeaderStyle(wsSup, supHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsSup, 'suppliers');

  // ── Stock In ──
  const siHeaders = ['ID', 'ID Produk', 'ID Pemasok', 'Jumlah', 'Harga Beli', 'Total Harga', 'Tanggal', 'Catatan'];
  const wsSi = XLSX.utils.aoa_to_sheet([
    siHeaders,
    ...stockIns.map(si => [
      si.id, si.productId, si.supplierId, si.quantity, si.buyPrice, si.totalPrice,
      new Date(si.date).toISOString(), si.notes
    ]),
  ]);
  wsSi['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 25 }];
  applyHeaderStyle(wsSi, siHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsSi, 'stock_ins');

  // ── Stock Out ──
  const soHeaders = ['ID', 'ID Produk', 'Jumlah', 'Alasan', 'Tanggal', 'Catatan'];
  const wsSo = XLSX.utils.aoa_to_sheet([
    soHeaders,
    ...stockOuts.map(so => [
      so.id, so.productId, so.quantity, so.reason, new Date(so.date).toISOString(), so.notes
    ]),
  ]);
  wsSo['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];
  applyHeaderStyle(wsSo, soHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsSo, 'stock_outs');

  // ── Transactions ──
  const txHeaders = ['ID', 'Subtotal', 'Tipe Diskon', 'Nilai Diskon', 'Jumlah Diskon', 'Total Pembayaran', 'ID Metode Pembayaran', 'Jumlah Bayar', 'Detail Pembayaran', 'Kembalian', 'Keuntungan', 'Tanggal', 'No. Struk', 'Status Transaksi', 'Status Dapur', 'No. Pesanan', 'Nama Pelanggan', 'No. Meja', 'Keterangan', 'Waktu Buka', 'Waktu Tutup'];
  const wsTx = XLSX.utils.aoa_to_sheet([
    txHeaders,
    ...transactions.map(t => [
      t.id, t.subtotal, t.discountType ?? '', t.discountValue, t.discountAmount, t.total, t.paymentMethodId, t.paymentAmount, t.payments ? JSON.stringify(t.payments) : '', t.change, t.profit,
      new Date(t.date).toISOString(), t.receiptNumber, t.status, t.kitchenStatus ?? '', t.orderNumber ?? '', t.customerName ?? '', t.tableNumber ?? '', t.remarks ?? '', '', ''
    ]),
  ]);
  wsTx['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  applyHeaderStyle(wsTx, txHeaders.length);
  XLSX.utils.book_append_sheet(wb, wsTx, 'transactions');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `mesenae-export-${dateStr}.xlsx`, WRITE_OPTS);
  toast.success('Export Excel berhasil diunduh');
}

// ─── Import ALL data from Excel (full restore) ────────────────────────────────
export interface ImportAllResult {
  products: number;
  categories: number;
  suppliers: number;
  stockIns: number;
  stockOuts: number;
  transactions: number;
  errors: string[];
}

export async function importAllDataFromExcel(file: File): Promise<ImportAllResult> {
  const result: ImportAllResult = {
    products: 0, categories: 0, suppliers: 0,
    stockIns: 0, stockOuts: 0, transactions: 0,
    errors: [],
  };

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const readSheet = (name: string): any[][] => {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
  };

  // ── Parse Categories ──
  const catRows = readSheet('Kategori');
  const newCategories: any[] = [];
  if (catRows.length > 1) {
    const hdr = (catRows[0] as string[]).map(h => String(h).trim().toLowerCase());
    const iName  = hdr.findIndex(h => h.includes('nama'));
    const iIcon  = hdr.findIndex(h => h.includes('ikon') || h.includes('icon'));
    const iColor = hdr.findIndex(h => h.includes('warna') || h.includes('color'));
    for (let i = 1; i < catRows.length; i++) {
      const row = catRows[i];
      const name = String(row[iName] ?? '').trim();
      if (!name) continue;
      newCategories.push({
        name,
        icon: iIcon >= 0 ? String(row[iIcon] ?? '📦').trim() : '📦',
        color: iColor >= 0 ? String(row[iColor] ?? '#95A5A6').trim() : '#95A5A6',
        created_at: new Date().toISOString(),
      });
    }
  }

  // Fetch existing from db
  const { data: existingCats } = await db.from('categories').select('*');
  const existingCatNames = new Set((existingCats || []).map(c => c.name.toLowerCase()));
  const catsToAdd = newCategories.filter(c => !existingCatNames.has(c.name.toLowerCase()));
  
  if (catsToAdd.length > 0) {
    await db.from('categories').insert(catsToAdd);
    result.categories = catsToAdd.length;
  }

  // Refetch all cats to map IDs
  const { data: allCatsDb } = await db.from('categories').select('*');
  const allCats = allCatsDb || [];
  const catNameToId = new Map(allCats.map(c => [c.name.toLowerCase(), c.id]));

  // ── Parse Products ──
  const prodRows = readSheet('Produk');
  const newProducts: any[] = [];
  if (prodRows.length > 1) {
    const hdr = (prodRows[0] as string[]).map(h => String(h).trim().toLowerCase());
    const iNama    = hdr.findIndex(h => h.includes('nama'));
    const iSku     = hdr.findIndex(h => h.includes('sku'));
    const iKat     = hdr.findIndex(h => h.includes('kategori') || h.includes('category'));
    const iHarga   = hdr.findIndex(h => h.includes('harga jual') || h.includes('harga'));
    const iHpp     = hdr.findIndex(h => h.includes('hpp'));
    const iStok    = hdr.findIndex(h => h.includes('stok'));
    const iSatuan  = hdr.findIndex(h => h.includes('satuan'));
    const iBarcode = hdr.findIndex(h => h.includes('barcode'));

    const VALID_UNITS = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
    const skusSeen = new Set<string>();

    for (let i = 1; i < prodRows.length; i++) {
      const row = prodRows[i];
      const name = String(row[iNama] ?? '').trim();
      const sku  = String(row[iSku] ?? '').trim();
      if (!name || !sku) continue;
      if (skusSeen.has(sku.toLowerCase())) {
        result.errors.push(`Produk baris ${i + 1}: SKU "${sku}" duplikat, dilewati`);
        continue;
      }
      skusSeen.add(sku.toLowerCase());

      // Resolve category by name
      const katName = iKat >= 0 ? String(row[iKat] ?? '').trim().toLowerCase() : '';
      const resolvedId = catNameToId.get(katName) ?? allCats[0]?.id ?? 0;

      const satuanRaw = iSatuan >= 0 ? String(row[iSatuan] ?? '').trim().toLowerCase() : 'pcs';
      newProducts.push({
        name, sku,
        category_id: resolvedId,
        price: iHarga >= 0 ? Number(row[iHarga]) || 0 : 0,
        hpp:   iHpp   >= 0 ? Number(row[iHpp])   || 0 : 0,
        stock: iStok  >= 0 ? Number(row[iStok])  || 0 : 0,
        unit: VALID_UNITS.includes(satuanRaw) ? satuanRaw : 'pcs',
        barcode: iBarcode >= 0 ? String(row[iBarcode] ?? '').trim() || null : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
    }
  }

  // Fetch existing products
  const { data: existingProductsData } = await db.from('products').select('*');
  const existingMap = new Map<string, any>();
  (existingProductsData || []).forEach(p => existingMap.set(p.sku.toLowerCase(), p));
  
  const prodsToAdd: any[] = [];
  const prodsToUpdate: { id: string | number, changes: any }[] = [];

  for (const p of newProducts) {
    const existing = existingMap.get(p.sku.toLowerCase());
    if (existing) {
      prodsToUpdate.push({
        id: existing.id,
        changes: {
          name: p.name,
          category_id: p.category_id !== 0 ? p.category_id : existing.category_id,
          price: p.price,
          hpp: p.hpp,
          stock: p.stock,
          unit: p.unit,
          barcode: p.barcode,
          updated_at: new Date().toISOString()
        }
      });
    } else {
      prodsToAdd.push(p);
    }
  }

  if (prodsToAdd.length > 0) {
    await db.from('products').insert(prodsToAdd);
    result.products += prodsToAdd.length;
  }
  
  if (prodsToUpdate.length > 0) {
    for (const update of prodsToUpdate) {
      await db.from('products').update(update.changes).eq('id', update.id);
    }
    result.products += prodsToUpdate.length;
  }

  if (result.categories === 0 && result.products === 0 && result.errors.length === 0) {
    result.errors.push('Tidak ada data yang bisa diimport dari file ini');
  } else {
    toast.success(
      `Import selesai: ${result.categories > 0 ? `${result.categories} kategori, ` : ''}${result.products} produk ditambahkan/diperbarui`
    );
  }

  return result;
}
