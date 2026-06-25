import { useState } from "react";
import { parseQRIS } from "../../../lib/qris-dinamis/index";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, ShieldCheck, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { QrisCard } from "@/components/payment/QrisCard";

interface Props {
  qrisString: string;
}

export function QRISResult({ qrisString }: Props) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const parsed = parseQRIS(qrisString);
  const nominalValue = Number(parsed.amount ?? 0);
  const formattedNominal = nominalValue.toLocaleString("id-ID");
  const isRendered = !!imageUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrisString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin:", err);
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    const sanitizedName = (parsed.merchantName || "mesenae").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const fileName = `qris-${sanitizedName}_${Date.now()}.png`;

    // @ts-ignore
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = imageUrl.split(',')[1];
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });
        alert(`QRIS disimpan di folder Documents (${fileName})`);
      } catch (err) {
        console.error("Gagal menyimpan file:", err);
      }
    } else {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = imageUrl;
      link.click();
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="px-5 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            QRIS Dinamis Siap
          </h2>
        </div>

        <div className="p-6 flex flex-col items-center space-y-6">
          
          {/* Preview Image with Modal Trigger */}
          <div 
            onClick={() => { if (isRendered) setPreviewOpen(true); }}
            className="group relative bg-slate-50/50 p-3 rounded-[28px] border border-border/60 shadow-inner cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
          >
            <QrisCard 
              qrisString={qrisString} 
              onCanvasRendered={setImageUrl} 
              className="w-[300px] h-[435px] rounded-[20px] shadow-sm pointer-events-none transition-transform duration-300 group-hover:scale-[1.01]"
            />
            {isRendered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 rounded-[28px] transition-all duration-300">
                <div className="bg-background/90 backdrop-blur-sm text-foreground px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                  <Maximize2 className="w-4 h-4" />
                  Perbesar
                </div>
              </div>
            )}
          </div>

          <div className="text-center space-y-1 w-full">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Nominal Pembayaran
            </p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              Rp {formattedNominal}
            </p>
            
            {parsed.tipIndicator === "fixed" && parsed.tipFixed && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium">Termasuk Biaya Rp {Number(parsed.tipFixed).toLocaleString("id-ID")}</p>
              </div>
            )}
            {parsed.tipIndicator === "percentage" && parsed.tipPercentage && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium">Termasuk Biaya {parsed.tipPercentage}%</p>
              </div>
            )}
          </div>

          <div className="w-full max-w-[340px] space-y-4 pt-2">
            <div className="flex items-center gap-2 p-1.5 bg-background rounded-xl border border-input shadow-sm">
              <div className="flex-1 px-3 text-xs font-mono text-muted-foreground truncate" title={qrisString}>
                {qrisString}
              </div>
              
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="h-8 rounded-lg px-3 shrink-0 bg-muted hover:bg-muted/80 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                    <span className="text-emerald-600 text-[11px] font-semibold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-foreground mr-1.5" />
                    <span className="text-[11px] font-semibold">Salin</span>
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={handleDownload}
              disabled={!isRendered}
              className="w-full h-12 rounded-xl gap-2 text-[15px] font-bold shadow-lg shadow-primary/25 transition-all active:scale-95"
            >
              <Download className="w-5 h-5" />
              Simpan PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Preview Gambar Besaran Penuh */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[440px] w-[95vw] bg-transparent border-none shadow-none p-0 flex flex-col items-center justify-center outline-none [&>button]:hidden">
          <div className="sr-only">
            <DialogTitle>Preview Kartu QRIS</DialogTitle>
          </div>
          
          {imageUrl && (
            <div className="relative flex flex-col items-center gap-5 w-full">
              <img 
                src={imageUrl} 
                alt="QRIS Result Preview" 
                className="w-full h-auto max-h-[80vh] object-contain rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-300"
              />
              
              <Button 
                variant="secondary" 
                onClick={() => setPreviewOpen(false)}
                className="rounded-full px-6 h-12 shadow-xl bg-background/95 backdrop-blur-md border border-border/50 hover:bg-background text-foreground font-semibold gap-2 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                Tutup Preview
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
