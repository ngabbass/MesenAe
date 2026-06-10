import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_COLORS } from '@/hooks/use-theme-color';

export interface StockReportData {
  storeName: string;
  startDate: string;
  endDate: string;
  totalStockIn: number;
  totalStockInValue: number;
  totalStockOut: number;
  currentStock: number;
  stockOutByReason: Record<string, number>;
  lowStockProducts: { name: string; stock: number; unit?: string }[];
  outOfStockProducts: { name: string }[];
  chartData: { date: string; stockIn: number; stockOut: number }[];
  themeHue?: string;
}

interface StockReportPrintProps {
  data: StockReportData;
}

function hueToHex(hue: string): { primary: string; dark: string; light: string; text: string } {
  const preset = THEME_COLORS.find(c => c.hue === hue);
  const h = Number(hue);
  const s = preset ? Number(preset.saturation.replace('%', '')) : 95;
  const l = preset ? Number(preset.lightness.replace('%', '')) : 53;

  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return {
    primary: hslToHex(h, s, l),
    dark: hslToHex(h, s, Math.max(l - 15, 20)),
    light: hslToHex(h, Math.max(s - 20, 20), Math.min(l + 30, 95)),
    text: l > 60 ? '#1e293b' : '#ffffff',
  };
}

// ── SVG Double Bar Chart (Stock In vs Out) ──
function PrintStockBarChart({ chartData }: { chartData: { date: string; stockIn: number; stockOut: number }[] }) {
  if (chartData.length === 0) return (
    <p style={{ fontSize: '8pt', color: '#94a3b8', textAlign: 'center', padding: '8mm 0' }}>Tidak ada aktivitas stok</p>
  );

  const maxVal = Math.max(...chartData.map(d => Math.max(d.stockIn, d.stockOut)), 1);
  const barW = 8;
  const groupGap = 4;
  const inOutGap = 1;
  const leftPad = 25;
  const rightPad = 8;
  const chartH = 70;
  const labelH = 22;
  const svgW = leftPad + chartData.length * (barW * 2 + inOutGap + groupGap) + rightPad;
  const svgH = chartH + labelH;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => maxVal * f);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="wkInGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="wkOutGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="1" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridVals.map((v, i) => {
        const y = chartH - (v / maxVal) * (chartH - 8);
        return (
          <g key={`grid-${i}`}>
            <line x1={leftPad - 2} y1={y} x2={svgW - rightPad} y2={y}
              stroke={i === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={i === 0 ? 1 : 0.5}
              strokeDasharray={i === 0 ? '0' : '2,2'} />
            {i > 0 && (
              <text x={leftPad - 4} y={y + 2} fontSize="4.5px" fill="#94a3b8" textAnchor="end">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
              </text>
            )}
          </g>
        );
      })}

      {/* Bars */}
      {chartData.map((d, i) => {
        const inH = Math.max((d.stockIn / maxVal) * (chartH - 8), d.stockIn > 0 ? 1 : 0);
        const outH = Math.max((d.stockOut / maxVal) * (chartH - 8), d.stockOut > 0 ? 1 : 0);
        const basePath = leftPad + i * (barW * 2 + inOutGap + groupGap);
        const xIn = basePath;
        const xOut = basePath + barW + inOutGap;
        const yIn = chartH - inH;
        const yOut = chartH - outH;
        const label = d.date.length > 5 ? d.date.slice(0, 5) : d.date;

        return (
          <g key={d.date}>
            <rect x={xIn} y={yIn} width={barW} height={inH} fill="url(#wkInGrad)" rx={1} />
            <rect x={xOut} y={yOut} width={barW} height={outH} fill="url(#wkOutGrad)" rx={1} />
            <text x={basePath + barW + inOutGap/2} y={chartH + 8} fontSize="4.5px" fill="#64748b" textAnchor="middle" fontWeight="600"
              transform={chartData.length > 14 ? `rotate(-40, ${basePath + barW}, ${chartH + 8})` : ''}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function StockReportPrint({ data }: StockReportPrintProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const theme = hueToHex(data.themeHue ?? '217');
  const rp = (n: number) => n.toLocaleString('id-ID');
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const content = (
    <div id="mesenae-print-section">
      <div className="wk-pr-wrapper">
        <div className="wk-pr-container">

          {/* ── HEADER ── */}
          <header className="wk-pr-header" style={{ background: `linear-gradient(135deg, #1e293b 0%, ${theme.dark} 100%)` }}>
            <div>
              <h1 className="wk-pr-store-name">{data.storeName}</h1>
              <p className="wk-pr-doc-title">Laporan Logistik &amp; Pergudangan</p>
            </div>
            <div className="wk-pr-header-right">
              <p className="wk-pr-period-label">Periode Laporan</p>
              <p className="wk-pr-period-date">{fmtDate(data.startDate)} – {fmtDate(data.endDate)}</p>
            </div>
          </header>

          {/* ── SUMMARY GRID ── */}
          <div className="wk-pr-summary-grid">
            {[
              { label: 'Total Barang Masuk', value: `${data.totalStockIn} Unit`, color: '#10b981' },
              { label: 'Total Barang Keluar', value: `${data.totalStockOut} Unit`, color: '#f43f5e' },
              { label: 'Sisa Stok Keseluruhan', value: `${data.currentStock} Unit`, color: '#3b82f6' },
              { label: 'Estimasi Nilai Belanja', value: `Rp ${rp(data.totalStockInValue)}`, color: '#0ea5e9' },
            ].map((item, idx) => (
              <div key={idx} className="wk-pr-summary-card" style={{ borderLeftColor: item.color, width: '24%' }}>
                <p className="wk-pr-summary-label">{item.label}</p>
                <p className="wk-pr-summary-value" style={{ fontSize: '10pt' }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '3mm', marginBottom: '3mm', alignItems: 'flex-start' }}>
            
            {/* ── CHART ── */}
            <div style={{ flex: 1.5, border: '1px solid #e2e8f0', borderRadius: '1.5mm', padding: '2mm', background: '#f8fafc' }}>
              <h3 className="wk-pr-section-title" style={{ color: theme.dark, display: 'flex', justifyContent: 'space-between' }}>
                <span>📊 Grafik Arus Barang Harian</span>
                <span style={{ fontSize: '5pt', color: '#64748b', fontWeight: 'normal' }}>
                  <span style={{color: '#10b981'}}>■ Masuk</span> &nbsp; <span style={{color: '#f43f5e'}}>■ Keluar</span>
                </span>
              </h3>
              <div style={{ width: '100%', height: '40mm' }}>
                <PrintStockBarChart chartData={data.chartData} />
              </div>
            </div>

            {/* ── ALASAN KELUAR ── */}
            {Object.keys(data.stockOutByReason).length > 0 && (
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '1.5mm', padding: '2mm' }}>
                <h3 className="wk-pr-section-title" style={{ color: '#e11d48' }}>Penyebab Stok Keluar</h3>
                <table className="wk-pr-table">
                  <tbody>
                    {Object.entries(data.stockOutByReason).map(([reason, qty]) => (
                      <tr key={reason}>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{reason}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{qty} Unit</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── PERINGATAN STOK MENIPIS / KOSONG ── */}
          <div style={{ display: 'flex', gap: '3mm' }}>
            
            {data.outOfStockProducts.length > 0 && (
              <div style={{ flex: 1, border: '2px solid #ffe4e6', borderRadius: '1.5mm', padding: '2mm', background: '#fff1f2' }}>
                <h3 className="wk-pr-section-title" style={{ color: '#e11d48' }}>🚨 STOK HABIS (0 Unit)</h3>
                <table className="wk-pr-table" style={{ background: 'transparent' }}>
                  <tbody>
                    {data.outOfStockProducts.map((p, i) => (
                      <tr key={p.name}>
                        <td style={{ width: '10%', fontWeight: 700 }}>{i + 1}.</td>
                        <td style={{ fontWeight: 700, color: '#9f1239' }}>{p.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.lowStockProducts.length > 0 && (
              <div style={{ flex: 1, border: '2px solid #fef3c7', borderRadius: '1.5mm', padding: '2mm', background: '#fffbeb' }}>
                <h3 className="wk-pr-section-title" style={{ color: '#d97706' }}>⚠️ STOK MENIPIS (≤ 5 Unit)</h3>
                <table className="wk-pr-table" style={{ background: 'transparent' }}>
                  <tbody>
                    {data.lowStockProducts.map((p, i) => (
                      <tr key={p.name}>
                        <td style={{ width: '10%', fontWeight: 700 }}>{i + 1}.</td>
                        <td style={{ fontWeight: 600, color: '#b45309' }}>{p.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>Sisa {p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
          </div>

          {/* ── FOOTER ── */}
          <div className="wk-pr-footer" style={{ borderTopColor: theme.light }}>
            <span>Dibuat oleh sistem <strong>MesenAe</strong> — Aplikasi Kasir UMKM</span>
            <span>Dicetak: {new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</span>
          </div>

        </div>
      </div>

      <style>{`
        /* Sembunyikan cetakan di layar normal (UI Aplikasi) */
        @media screen {
          #mesenae-print-section { display: none !important; }
        }

        /* Tampilkan khusus di window.print (Browser) */
        @media print {
          @page { size: A4 portrait; margin: 10mm 8mm; }
          body > :not(#mesenae-print-section) { display: none !important; }
          #mesenae-print-section { 
            display: block !important; 
            position: static !important; 
            width: 100% !important; 
            visibility: visible !important; 
            opacity: 1 !important; 
          }
        }

        /* Di bawah ini adalah gaya struktural yang diletakkan DI LUAR @media print.
          Tujuannya agar saat Capacitor mengekstrak file ini menjadi .html murni,
          mesin render Native tetap bisa membaca CSS-nya secara sempurna.
        */
        
        .wk-pr-wrapper { display: block !important; position: static !important; width: 100% !important; }

        .wk-pr-container {
          width: 100% !important; max-width: 100% !important;
          box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          background: white !important; color: #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        * { box-sizing: border-box !important; }

        .wk-pr-header {
          display: flex !important; justify-content: space-between !important;
          align-items: center !important; color: white !important;
          padding: 3mm 4mm !important; border-radius: 2mm !important;
          margin-bottom: 3mm !important;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .wk-pr-header-right { text-align: right; }
        .wk-pr-store-name { font-size: 14pt !important; font-weight: 900 !important; margin: 0 !important; text-transform: uppercase !important; color: white !important; }
        .wk-pr-doc-title { font-size: 7pt !important; font-weight: 600 !important; margin: 1mm 0 0 !important; opacity: 0.9 !important; color: white !important; }
        .wk-pr-period-label { font-size: 6pt !important; opacity: 0.8 !important; margin: 0 0 0.5mm !important; text-transform: uppercase !important; color: white !important; }
        .wk-pr-period-date { font-size: 8pt !important; font-weight: 800 !important; margin: 0 !important; color: white !important; }

        .wk-pr-summary-grid {
          display: flex !important; justify-content: space-between !important;
          margin-bottom: 3mm !important;
        }
        .wk-pr-summary-card {
          padding: 2mm 2.5mm !important; border-radius: 1.5mm !important;
          border: 1px solid #e2e8f0 !important; border-left-width: 2.5mm !important;
          background: #f8fafc !important;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .wk-pr-summary-label { font-size: 5.5pt !important; text-transform: uppercase !important; font-weight: 800 !important; margin: 0 0 1mm !important; color: #64748b !important; line-height: 1.2 !important; }
        .wk-pr-summary-value { font-size: 8pt !important; font-weight: 900 !important; margin: 0 !important; color: #0f172a !important; }

        .wk-pr-section-title {
          font-size: 7.5pt !important; font-weight: 800 !important;
          margin: 0 0 1.5mm !important; text-transform: uppercase !important;
          letter-spacing: 0.2mm !important;
        }

        .wk-pr-table { width: 100% !important; border-collapse: collapse !important; font-size: 7.5pt !important; }
        .wk-pr-table td { padding: 1mm 1.5mm !important; border-bottom: 0.5pt solid #e2e8f0 !important; color: #334155 !important; }
        .wk-pr-table tr:last-child td { border-bottom: none !important; }

        .wk-pr-footer {
          display: flex !important; justify-content: space-between !important;
          align-items: center !important; margin-top: 4mm !important;
          padding-top: 2mm !important; border-top: 0.5pt solid !important;
          font-size: 6pt !important; color: #94a3b8 !important;
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
