import { useState, useCallback } from "react";
import { parseQRIS, convertQRIS, validateQRIS } from "../../lib/qris-dinamis/index";
import type { QRISData, ConvertOptions } from "../../lib/qris-dinamis/types";
import { QRISInput } from "../components/qris-dinamis/QRISInput";
import { QRISInfo } from "../components/qris-dinamis/QRISInfo";
import { ConvertForm } from "../components/qris-dinamis/ConvertForm";
import { QRISResult } from "../components/qris-dinamis/QRISResult";
import { QrCode, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

export default function QrisDinamisMenu() {
  const { canEdit } = usePermissions();
  const canEditDashboard = canEdit('dashboard');
  const [qrisString, setQrisString] = useState("");
  const [parsed, setParsed] = useState<QRISData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState("");

  const handleQRISInput = useCallback((value: string) => {
    setQrisString(value);
    setResult("");
    setErrors([]);
    setParsed(null);

    if (!value.trim()) return;

    const validation = validateQRIS(value.trim());
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const data = parseQRIS(value.trim());
      setParsed(data);
    } catch {
      setErrors(["Gagal membaca data QRIS"]);
    }
  }, []);

  const handleConvert = useCallback(
    (options: ConvertOptions) => {
      if (!qrisString.trim()) return;

      try {
        const converted = convertQRIS(qrisString.trim(), options);
        setResult(converted);
      } catch {
        setErrors(["Gagal mengkonversi QRIS"]);
      }
    },
    [qrisString]
  );

  const handleReset = useCallback(() => {
    setQrisString("");
    setParsed(null);
    setErrors([]);
    setResult("");
  }, []);

  return (
    <div className="pb-24 space-y-4 w-full animate-in fade-in duration-300">
      
      {/* Read-only warning */}
      {!canEditDashboard && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengonversi QRIS. Silakan hubungi admin untuk mendapatkan akses penuh.</span>
        </div>
      )}

      {/* Tombol Kembali ke Dashboard */}
      <div className="flex items-center justify-start w-full">
        <Link to="/admin">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 gap-2 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* Kolom Kiri — Input */}
        <div className="xl:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                Input String QRIS
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste string QRIS, scan kamera, atau upload gambar QR Code
              </p>
            </div>
            <div className="p-5">
              <QRISInput
                value={qrisString}
                onChange={handleQRISInput}
                onReset={handleReset}
                errors={errors}
                disabled={!canEditDashboard}
              />
            </div>
          </div>
        </div>

        {/* Kolom Kanan — Info + Convert + Result */}
        <div className="xl:col-span-7 space-y-4">
          {!parsed && !result && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <QrCode className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground/60">Hasil akan muncul di sini</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Masukkan string QRIS statis di kolom kiri untuk mulai mengkonversi
              </p>
            </div>
          )}

          {parsed && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <QRISInfo data={parsed} />
              <ConvertForm parsed={parsed} onConvert={handleConvert} disabled={!canEditDashboard} />
            </div>
          )}

          {result && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <QRISResult qrisString={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
