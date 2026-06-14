import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { parseQRIS } from "@/lib/qris-dinamis/index";
import { Loader2 } from "lucide-react";

interface Props {
  qrisString: string;
  onCanvasRendered?: (dataUrl: string) => void;
  className?: string;
}

export function QrisCard({ qrisString, onCanvasRendered, className }: Props) {
  const [renderedSrc, setRenderedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!qrisString) return;
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parsed = parseQRIS(qrisString);
    const nominalValue = Number(parsed.amount ?? 0);
    const formattedNominal = nominalValue.toLocaleString("id-ID");

    const scale = 4;
    const width = 400;   
    const height = 580; // Full height to include footer
    const cardRadius = 24;

    canvas.width = width * scale;
    canvas.height = height * scale;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const drawRoundedRect = (
      context: CanvasRenderingContext2D, 
      x: number, y: number, w: number, h: number, r: number
    ) => {
      context.beginPath();
      context.moveTo(x + r, y);
      context.lineTo(x + w - r, y);
      context.quadraticCurveTo(x + w, y, x + w, y + r);
      context.lineTo(x + w, y + h - r);
      context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      context.lineTo(x + r, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - r);
      context.lineTo(x, y + r);
      context.quadraticCurveTo(x, y, x + r, y);
      context.closePath();
    };

    // 1. Base Kartu Putih Solid
    drawRoundedRect(ctx, 0, 0, width, height, cardRadius);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // 2. POLA KAWUNG
    ctx.save();
    drawRoundedRect(ctx, 0, 0, width, height, cardRadius);
    ctx.clip(); 

    const patCanvas = document.createElement("canvas");
    const pSize = 56; 
    patCanvas.width = pSize;
    patCanvas.height = pSize;
    const pCtx = patCanvas.getContext("2d");
    
    if (pCtx) {
      pCtx.strokeStyle = "rgba(100, 116, 139, 0.2)"; 
      pCtx.lineWidth = 1.5;
      pCtx.lineCap = "square";
      const center = pSize / 2;
      pCtx.strokeRect(12, 12, 32, 32); 
      pCtx.strokeRect(20, 20, 16, 16); 
      pCtx.beginPath();
      pCtx.moveTo(center, 0); pCtx.lineTo(center, 12); 
      pCtx.moveTo(center, 44); pCtx.lineTo(center, pSize); 
      pCtx.moveTo(0, center); pCtx.lineTo(12, center); 
      pCtx.moveTo(44, center); pCtx.lineTo(pSize, center); 
      pCtx.stroke();
      const cSize = 10;
      const halfC = cSize / 2;
      pCtx.strokeRect(-halfC, -halfC, cSize, cSize);
      pCtx.strokeRect(pSize - halfC, -halfC, cSize, cSize);
      pCtx.strokeRect(-halfC, pSize - halfC, cSize, cSize);
      pCtx.strokeRect(pSize - halfC, pSize - halfC, cSize, cSize);
    }
    
    const pattern = ctx.createPattern(patCanvas, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.beginPath();
      ctx.moveTo(0, 220); 
      ctx.lineTo(360, 580); 
      ctx.lineTo(0, 580);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(400, 220); 
      ctx.lineTo(40, 580); 
      ctx.lineTo(400, 580);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. AKSEN SEGITIGA MERAH
    ctx.save();
    drawRoundedRect(ctx, 0, 0, width, height, cardRadius);
    ctx.clip(); 
    const qrisRed = "#DA291C"; 
    ctx.fillStyle = qrisRed;
    ctx.beginPath();
    ctx.moveTo(0, 140);
    ctx.lineTo(110, 250);
    ctx.lineTo(0, 360);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(250, height);
    ctx.lineTo(400, height - 150); 
    ctx.lineTo(400, height);
    ctx.fill();
    ctx.restore(); 

    // 4. FOOTER (Teks Original)
    const footerX = 25; 
    ctx.textAlign = "left";
    
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 15px 'Inter', system-ui, sans-serif";
    ctx.fillText(`QRIS Dinamis - Rp ${formattedNominal}`, footerX, 540);

    ctx.fillStyle = "#64748b"; 
    ctx.font = "500 12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Powered by MesenAe", footerX, 560);

    // PROSES ASYNC
    const renderAssets = async () => {
      try {
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/ico/qris.svg"; 

        const gpn = new Image();
        gpn.crossOrigin = "anonymous";
        gpn.src = "/ico/gpn.svg"; 
        
        await Promise.all([
          new Promise((resolve, reject) => {
            logo.onload = resolve;
            logo.onerror = reject;
          }),
          new Promise((resolve, reject) => {
            gpn.onload = resolve;
            gpn.onerror = reject;
          }).catch(() => {})
        ]);

        const gpnHeight = 40;
        const gpnRatio = gpn.width / gpn.height || 0.788;
        const gpnWidth = gpn.width > 0 ? (gpnHeight * gpnRatio) : (gpnHeight * 0.788);
        const gpnX = width - 25 - gpnWidth;
        const gpnY = 24;

        const logoRatio = logo.width / logo.height || 2.70978;
        const logoTargetHeight = 32;
        const logoTargetWidth = logoTargetHeight * logoRatio;
        const logoX = 25;
        const logoY = 32;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = logo.width;
        tempCanvas.height = logo.height;
        const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
        if (tempCtx) {
          tempCtx.drawImage(logo, 0, 0);
          const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
            const avg = (r + g + b) / 3;
            if (avg > 210) {
              const alpha = Math.max(0, 255 - (avg - 210) * (255 / 45)); 
              data[i + 3] = Math.min(data[i + 3], alpha);
            }
          }
          tempCtx.putImageData(imgData, 0, 0);
          ctx.drawImage(tempCanvas, logoX, logoY, logoTargetWidth, logoTargetHeight);
        } else {
          ctx.drawImage(logo, logoX, logoY, logoTargetWidth, logoTargetHeight);
        }

        if (gpn.width > 0) {
          const gpnCanvas = document.createElement("canvas");
          gpnCanvas.width = gpn.width;
          gpnCanvas.height = gpn.height;
          const gpnCtx = gpnCanvas.getContext("2d", { willReadFrequently: true });
          if (gpnCtx) {
            gpnCtx.drawImage(gpn, 0, 0);
            const gpnImgData = gpnCtx.getImageData(0, 0, gpnCanvas.width, gpnCanvas.height);
            const gpnData = gpnImgData.data;
            for (let i = 0; i < gpnData.length; i += 4) {
              const r = gpnData[i]; const g = gpnData[i + 1]; const b = gpnData[i + 2];
              const avg = (r + g + b) / 3;
              if (avg > 210) {
                const alpha = Math.max(0, 255 - (avg - 210) * (255 / 45));
                gpnData[i + 3] = Math.min(gpnData[i + 3], alpha);
              }
            }
            gpnCtx.putImageData(gpnImgData, 0, 0);
            ctx.drawImage(gpnCanvas, gpnX, gpnY, gpnWidth, gpnHeight);
          } else {
            ctx.drawImage(gpn, gpnX, gpnY, gpnWidth, gpnHeight);
          }
        }

        const textStartX = logoX + logoTargetWidth + 14;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.font = "800 13px 'Inter', system-ui, sans-serif";
        ctx.fillText("QR Code Standar", textStartX, 44); 
        ctx.fillStyle = "#334155";
        ctx.font = "600 12px 'Inter', system-ui, sans-serif";
        ctx.fillText("Pembayaran Nasional", textStartX, 60);

        let fontSize = 24;
        ctx.font = `800 ${fontSize}px 'Inter', system-ui, sans-serif`;
        let displayName = parsed.merchantName || "Mesen.Ae";
        const maxTextWidth = 340; 
        while (ctx.measureText(displayName).width > maxTextWidth && fontSize > 16) {
          fontSize -= 1;
          ctx.font = `800 ${fontSize}px 'Inter', system-ui, sans-serif`;
        }
        if (ctx.measureText(displayName).width > maxTextWidth) {
          while (ctx.measureText(displayName + "...").width > maxTextWidth && displayName.length > 0) {
            displayName = displayName.slice(0, -1);
          }
          displayName += "...";
        }
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.fillText(displayName, width / 2, 135);

        const match = qrisString.match(/0215(ID[A-Z0-9]{13})/);
        const currentNmid = match ? match[1] : "";
        if (currentNmid) {
          ctx.fillStyle = "#334155"; 
          ctx.font = "500 14px 'Inter', system-ui, sans-serif";
          ctx.fillText(`NMID: ${currentNmid}`, width / 2, 160);
        }

        const qrBoxSize = 310;
        const qrBoxX = (width - qrBoxSize) / 2; 
        const qrBoxY = 190; // Align to 190 like QRISResult
        
        ctx.fillStyle = "#FFFFFF";
        drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
        ctx.fill();

        const qrVirtualCanvas = document.createElement("canvas");
        const qrInnerSize = 290; 
        await QRCode.toCanvas(qrVirtualCanvas, qrisString, {
          width: qrInnerSize,
          margin: 1, 
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "M", 
        });

        const qrInnerX = qrBoxX + (qrBoxSize - qrInnerSize) / 2;
        const qrInnerY = qrBoxY + (qrBoxSize - qrInnerSize) / 2;
        ctx.drawImage(qrVirtualCanvas, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);

        const dataUrl = canvas.toDataURL("image/png", 1.0);
        setRenderedSrc(dataUrl);
        if (onCanvasRendered) {
          onCanvasRendered(dataUrl);
        }

      } catch (error) {
        console.error("Gagal me-render QRIS Canvas:", error);
      }
    };

    renderAssets();
  }, [qrisString]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!renderedSrc) {
    return (
      <div 
        className={`bg-white border border-border/80 flex flex-col items-center justify-center gap-3 animate-pulse shadow-sm ${className || 'w-full max-w-[300px] aspect-[400/580] rounded-[20px]'}`}
        style={{ contentVisibility: 'auto' }}
      >
        <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
        <p className="text-[10px] text-muted-foreground font-semibold">Menyiapkan QRIS...</p>
      </div>
    );
  }

  return (
    <img 
      src={renderedSrc} 
      className={className || "w-full max-w-[300px] h-auto rounded-[20px] shadow-sm"} 
      alt="QRIS Card" 
    />
  );
}
