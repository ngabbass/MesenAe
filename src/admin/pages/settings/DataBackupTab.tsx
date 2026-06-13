import React, { useState, useRef } from 'react';
import { Section, SettingCard, SettingRow } from '../Settings';
import { Loader2 } from 'lucide-react';
import JsonIcon from '@/components/ui/JsonIcon';
import ExcelIcon from '@/components/ui/ExcelIcon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportAllDataToJSON, importAllDataFromJSON } from '@/lib/backup-utils';
import { downloadProductTemplate, importProductsFromExcel } from '@/lib/excel-utils';
import { cn } from '@/lib/utils';

export default function DataBackupTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  /* ── Excel States & Refs ── */
  const [isExporting, setIsExporting] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [isImportingProd, setIsImportingProd] = useState(false);
  const allDataInputRef = useRef<HTMLInputElement>(null);
  const prodInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengimpor atau memulihkan basis data toko.</span>
        </div>
      )}
      <div className={cn("space-y-4", !hasEditAccess && "pointer-events-none opacity-75")}>
        <Section hideHeader title="Data & Backup" description="Ekspor atau impor seluruh data toko menggunakan format JSON.">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Backup Total Database</p>
            <SettingCard>
              <SettingRow label="Export Semua Data (JSON)" description="Ekspor cadangan berkas JSON seluruh tabel database toko untuk cadangan penuh.">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    setIsExporting(true);
                    const blob = await exportAllDataToJSON();
                    if (blob) {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mesenae-backup-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      toast.success('Backup JSON berhasil diunduh');
                    } else {
                      toast.error('Gagal membuat backup');
                    }
                  } finally { setIsExporting(false); }
                }} disabled={isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <JsonIcon className="w-4 h-4 mr-2 text-amber-500" />}
                  Export JSON
                </Button>
              </SettingRow>
              <SettingRow label="Restore Database (JSON)" description="Pulihkan seluruh data dari berkas JSON cadangan. Peringatan: aksi ini menimpa data saat ini." last>
                <Button variant="outline" size="sm" onClick={() => allDataInputRef.current?.click()} disabled={isImportingAll || !hasEditAccess}>
                  {isImportingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <JsonIcon className="w-4 h-4 mr-2 text-rose-500" />}
                  Restore JSON
                </Button>
                <input type="file" ref={allDataInputRef} className="hidden" accept=".json" onChange={async (e) => {
                  if (!hasEditAccess) {
                    toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
                    return;
                  }
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsImportingAll(true);
                  try {
                    const res = await importAllDataFromJSON(file);
                    if (res.success) toast.success(`Berhasil memulihkan ${res.imported} dokumen`);
                    else toast.error('Format backup tidak valid atau gagal');
                  } catch (err: any) { toast.error('Gagal restore data: ' + err.message); }
                  finally { setIsImportingAll(false); if (allDataInputRef.current) allDataInputRef.current.value = ''; }
                }} />
              </SettingRow>
            </SettingCard>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Produk Khusus</p>
            <SettingCard>
              <SettingRow label="Download Template Produk" description="Unduh format Excel kosong untuk mengisi data produk baru secara massal.">
                <Button variant="outline" size="sm" onClick={downloadProductTemplate}>
                  <ExcelIcon className="w-4 h-4 mr-2 text-[#0f773d]" />
                  Template Excel
                </Button>
              </SettingRow>
              <SettingRow label="Import Produk Masal" description="Unggah berkas produk massal dari template Excel yang telah diisi." last>
                <Button variant="outline" size="sm" onClick={() => prodInputRef.current?.click()} disabled={isImportingProd || !hasEditAccess}>
                  {isImportingProd ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExcelIcon className="w-4 h-4 mr-2 text-blue-600" />}
                  Upload Produk
                </Button>
                <input type="file" ref={prodInputRef} className="hidden" accept=".xlsx,.xls" onChange={async (e) => {
                  if (!hasEditAccess) {
                    toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
                    return;
                  }
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsImportingProd(true);
                  try {
                    const res = await importProductsFromExcel(file);
                    if (res.errors.length) toast.error(`Selesai dengan error: ${res.errors[0]}`);
                    else toast.success(`Berhasil import ${res.imported} produk`);
                  } catch (err: any) { toast.error('Gagal import produk: ' + err.message); }
                  finally { setIsImportingProd(false); if (prodInputRef.current) prodInputRef.current.value = ''; }
                }} />
              </SettingRow>
            </SettingCard>
          </div>
        </Section>
      </div>
    </div>
  );
}
