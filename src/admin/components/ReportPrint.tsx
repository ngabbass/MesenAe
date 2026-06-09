import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_COLORS } from '@/hooks/use-theme-color';

export interface MesenAeReportData {
  storeName: string;
  startDate: string;
  endDate: string;
  txCount: number;
  totalRevenue: number;
  totalDiscount: number;
  netSales: number;
  totalHpp: number;
  grossProfit: number;
  marginPercent: number;
  topProducts: { name: string; qty: number; revenue: number; profit: number; stock: number }[];
  bottomProducts: { name: string; qty: number; revenue: number; profit: number; stock: number }[];
  soldProducts?: { date?: string; name: string; qty: number; revenue: number; profit: number; stock: number }[];
  chartData: { date: string; sales: number }[];
  themeHue?: string; // HSL hue from store settings
  totalExpenses?: number;
  netProfit?: number;
  expensesList?: { date: string; title: string; categoryName: string; amount: number; notes?: string }[];
}

interface ReportPrintProps {
  data: MesenAeReportData;
}

// ── Resolve theme color to hex for print CSS ──────────────────────────────────
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

// ── SVG Line Chart ─────────────────────────────────────────────────────────────
function PrintLineChart({
  chartData,
  primaryColor
}: {
  chartData: { date: string; sales: number; expenses: number }[];
  primaryColor: string;
}) {
  if (chartData.length === 0) return (
    <p style={{ fontSize: '8pt', color: '#94a3b8', textAlign: 'center', padding: '8mm 0' }}>Tidak ada data</p>
  );

  const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.expenses)), 1);
  const leftPad = 26;
  const rightPad = 8;
  const chartH = 65;
  const labelH = 15;
  const chartW = 180; // Fixed coordinate width
  const svgW = leftPad + chartW + rightPad;
  const svgH = chartH + labelH;

  const stepX = chartData.length > 1 ? chartW / (chartData.length - 1) : chartW;

  // Generate grid values
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => maxVal * f);

  // Line paths
  let salesPath = '';
  let expensesPath = '';
  chartData.forEach((d, i) => {
    const x = leftPad + i * stepX;
    const ySales = chartH - (d.sales / maxVal) * (chartH - 8);
    const yExpenses = chartH - (d.expenses / maxVal) * (chartH - 8);
    if (i === 0) {
      salesPath = `M ${x} ${ySales}`;
      expensesPath = `M ${x} ${yExpenses}`;
    } else {
      salesPath += ` L ${x} ${ySales}`;
      expensesPath += ` L ${x} ${yExpenses}`;
    }
  });

  const firstX = leftPad;
  const lastX = leftPad + (chartData.length - 1) * stepX;
  const salesAreaPath = chartData.length > 0 ? `${salesPath} L ${lastX} ${chartH} L ${firstX} ${chartH} Z` : '';
  const expensesAreaPath = chartData.length > 0 ? `${expensesPath} L ${lastX} ${chartH} L ${firstX} ${chartH} Z` : '';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', overflow: 'visible', fontFamily: 'Arial, sans-serif' }}>
        <defs>
          <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="expensesAreaGrad" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {gridVals.map((v, i) => {
          const y = chartH - (v / maxVal) * (chartH - 8);
          return (
            <g key={i}>
              <line x1={leftPad - 2} y1={y} x2={leftPad + chartW + 2} y2={y}
                stroke={i === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={i === 0 ? 1.2 : 0.6}
                strokeDasharray={i === 0 ? '0' : '2,2'} />
              {i > 0 && (
                <text x={leftPad - 4} y={y + 2} fontSize="5.5px" fill="#94a3b8" textAnchor="end" fontWeight="700">
                  {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}Jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v}
                </text>
              )}
            </g>
          );
        })}

        {/* Areas */}
        {chartData.length > 0 && (
          <>
            <path d={salesAreaPath} fill="url(#salesAreaGrad)" />
            <path d={expensesAreaPath} fill="url(#expensesAreaGrad)" />
          </>
        )}

        {/* Lines */}
        {chartData.length > 0 && (
          <>
            <path d={salesPath} fill="none" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={expensesPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Dots */}
        {chartData.map((d, i) => {
          const x = leftPad + i * stepX;
          const ySales = chartH - (d.sales / maxVal) * (chartH - 8);
          const yExpenses = chartH - (d.expenses / maxVal) * (chartH - 8);
          return (
            <g key={i}>
              <circle cx={x} cy={ySales} r="1.6" fill={primaryColor} stroke="#ffffff" strokeWidth="0.5" />
              <circle cx={x} cy={yExpenses} r="1.6" fill="#ef4444" stroke="#ffffff" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* X Axis Labels */}
        {chartData.map((d, i) => {
          const showLabel = chartData.length <= 10 || i % Math.ceil(chartData.length / 8) === 0 || i === chartData.length - 1;
          if (!showLabel) return null;
          
          const x = leftPad + i * stepX;
          const label = d.date.length > 5 ? d.date.slice(0, 5) : d.date;
          return (
            <text key={d.date} x={x} y={chartH + 9} fontSize="5.5px" fill="#64748b" textAnchor="middle" fontWeight="700">
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '5mm', justifyContent: 'center', marginTop: '1.5mm', fontSize: '6.5pt' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2mm' }}>
          <span style={{ display: 'inline-block', width: '5mm', height: '1.2mm', background: primaryColor, borderRadius: '0.4mm' }} />
          <span style={{ fontWeight: 'bold', color: '#475569' }}>Penjualan</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2mm' }}>
          <span style={{ display: 'inline-block', width: '5mm', height: '1.2mm', background: '#ef4444', borderRadius: '0.4mm' }} />
          <span style={{ fontWeight: 'bold', color: '#475569' }}>Pengeluaran</span>
        </div>
      </div>
    </div>
  );
}

// ── SVG Donut / Pie Chart ─────────────────────────────────────────────────────
function PrintPieChart({
  netSales, totalHpp, grossProfit, totalDiscount, primaryColor
}: {
  netSales: number; totalHpp: number; grossProfit: number; totalDiscount: number; primaryColor: string;
}) {
  const segments = [
    { label: 'Laba Kotor', value: Math.max(0, grossProfit), color: '#10b981' },
    { label: 'HPP / Modal', value: Math.max(0, totalHpp), color: primaryColor },
    { label: 'Diskon', value: Math.max(0, totalDiscount), color: '#f59e0b' },
  ].filter(s => s.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = 65, cy = 65, r = 52, ri = 28;
  let currentAngle = -90;

  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    if (pct <= 0) return { ...seg, d: '', pct: 0 };
    if (pct >= 0.999) {
      return { ...seg, pct, d: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` };
    }
    const angle = pct * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    const toRad = (deg: number) => deg * Math.PI / 180;
    const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end)), y2 = cy + r * Math.sin(toRad(end));
    const xi1 = cx + ri * Math.cos(toRad(start)), yi1 = cy + ri * Math.sin(toRad(start));
    const xi2 = cx + ri * Math.cos(toRad(end)), yi2 = cy + ri * Math.sin(toRad(end));
    const large = angle > 180 ? 1 : 0;
    return {
      ...seg, pct,
      d: `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z`,
    };
  });

  const rp = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}Jt` : n >= 1000 ? `${(n / 1000).toFixed(0)}rb` : n.toString();

  return (
    <svg width="100%" height="100%" viewBox="0 0 260 130" style={{ display: 'block', overflow: 'visible' }}>
      {/* Donut slices */}
      {arcs.map(arc => arc.d ? <path key={arc.label} d={arc.d} fill={arc.color} /> : null)}

      {/* Center label */}
      <text x={cx} y={cy - 4} fontSize="8px" fill="#0f172a" textAnchor="middle" fontWeight="900">
        {(Math.max(0, grossProfit) / total * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 7} fontSize="6px" fill="#64748b" textAnchor="middle" fontWeight="600">Laba</text>

      {/* Legend */}
      {arcs.map((arc, i) => (
        <g key={arc.label} transform={`translate(138, ${12 + i * 36})`}>
          <rect x={0} y={0} width={10} height={10} rx={2} fill={arc.color} />
          <text x={14} y={8} fontSize="7.5px" fill="#334155" fontWeight="700">{arc.label}</text>
          <text x={14} y={20} fontSize="7px" fill="#0f172a" fontWeight="900">Rp {rp(arc.value)}</text>
          <text x={14} y={30} fontSize="6px" fill="#94a3b8">{(arc.pct * 100).toFixed(1)}%</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportPrint({ data }: ReportPrintProps) {
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
          <header className="wk-pr-header" style={{ background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.primary} 100%)` }}>
            <div>
              <h1 className="wk-pr-store-name">{data.storeName}</h1>
              <p className="wk-pr-doc-title">Laporan Keuangan &amp; Penjualan</p>
            </div>
            <div className="wk-pr-header-right">
              <p className="wk-pr-period-label">Periode Laporan</p>
              <p className="wk-pr-period-date">{fmtDate(data.startDate)} – {fmtDate(data.endDate)}</p>
            </div>
          </header>

          {/* ── SUMMARY GRID ── */}
          <div className="wk-pr-summary-grid">
            {[
              { label: 'Jumlah Transaksi', value: `${data.txCount} transaksi`, color: theme.primary },
              { label: 'Pendapatan Kotor', value: `Rp ${rp(data.totalRevenue)}`, color: '#3b82f6' },
              { label: 'Total Diskon', value: `Rp ${rp(data.totalDiscount)}`, color: '#e11d48' },
              { label: 'Penjualan Bersih', value: `Rp ${rp(data.netSales)}`, color: '#10b981' },
              { label: 'HPP / Modal', value: `Rp ${rp(data.totalHpp)}`, color: '#f59e0b' },
              { label: 'Total Pengeluaran', value: `Rp ${rp(data.totalExpenses ?? 0)}`, color: '#ec4899' },
              { label: 'Laba Bersih', value: `Rp ${rp(data.netProfit ?? 0)}`, color: '#8b5cf6' },
              { label: 'Margin Keuntungan', value: `${data.marginPercent.toFixed(1)}%`, color: '#6366f1' },
            ].map(item => (
              <div key={item.label} className="wk-pr-summary-card" style={{ borderLeftColor: item.color }}>
                <p className="wk-pr-summary-label">{item.label}</p>
                <p className="wk-pr-summary-value">{item.value}</p>
              </div>
            ))}
          </div>

          {/* ── LABA KOTOR & LABA BERSIH (SIDE BY SIDE) ── */}
          <div style={{ display: 'flex', gap: '3mm', marginBottom: '2.5mm' }}>
            <div className="wk-pr-net-box" style={{
              flex: 1,
              marginBottom: 0,
              background: data.grossProfit >= 0 ? '#f0fdf4' : '#fff1f2',
              borderColor: data.grossProfit >= 0 ? '#10b981' : '#e11d48',
            }}>
              <div>
                <p className="wk-pr-net-title">Laba Kotor (Gross Profit)</p>
                <p className="wk-pr-net-sub">Penjualan Bersih − HPP</p>
              </div>
              <p className="wk-pr-net-value" style={{ color: data.grossProfit >= 0 ? '#059669' : '#dc2626' }}>
                {data.grossProfit >= 0 ? '+' : '−'} Rp {rp(Math.abs(data.grossProfit))}
              </p>
            </div>

            <div className="wk-pr-net-box" style={{
              flex: 1,
              marginBottom: 0,
              background: (data.netProfit ?? 0) >= 0 ? '#eff6ff' : '#fff1f2',
              borderColor: (data.netProfit ?? 0) >= 0 ? '#3b82f6' : '#e11d48',
            }}>
              <div>
                <p className="wk-pr-net-title">Laba Bersih (Net Profit)</p>
                <p className="wk-pr-net-sub">Laba Kotor − Pengeluaran</p>
              </div>
              <p className="wk-pr-net-value" style={{ color: (data.netProfit ?? 0) >= 0 ? '#2563eb' : '#dc2626' }}>
                {(data.netProfit ?? 0) >= 0 ? '+' : '−'} Rp {rp(Math.abs(data.netProfit ?? 0))}
              </p>
            </div>
          </div>

          {/* ── CHARTS SIDE BY SIDE ── */}
          <div className="wk-pr-charts-row">
            <div className="wk-pr-chart-left">
              <h3 className="wk-pr-section-title" style={{ color: theme.primary }}>📈 Tren Penjualan &amp; Pengeluaran</h3>
              <div className="wk-pr-chart-wrap" style={{ height: '47mm' }}>
                <PrintLineChart chartData={data.chartData} primaryColor={theme.primary} />
              </div>
            </div>
            <div className="wk-pr-chart-right">
              <h3 className="wk-pr-section-title" style={{ color: theme.primary }}>🥧 Distribusi Pendapatan</h3>
              <div className="wk-pr-pie-wrap">
                <PrintPieChart
                  netSales={data.netSales}
                  totalHpp={data.totalHpp}
                  grossProfit={data.grossProfit}
                  totalDiscount={data.totalDiscount}
                  primaryColor={theme.primary}
                />
              </div>
            </div>
          </div>

          {/* ── ALL SOLD PRODUCTS TABLE ── */}
          <div className="wk-pr-table-section">
            <h3 className="wk-pr-section-title-lg" style={{ borderBottomColor: theme.primary }}>
              Daftar Produk Terjual
            </h3>
            {data.soldProducts && data.soldProducts.length > 0 ? (
              <table className="wk-pr-table">
                <thead>
                  <tr>
                    <th style={{ width: '5%', background: theme.dark }}>No</th>
                    <th style={{ width: '15%', background: theme.dark }}>Tanggal</th>
                    <th style={{ width: '28%', background: theme.dark }}>Nama Produk</th>
                    <th style={{ width: '10%', textAlign: 'right', background: theme.dark }}>Terjual</th>
                    <th style={{ width: '12%', textAlign: 'right', background: theme.dark }}>Sisa Stok</th>
                    <th style={{ width: '15%', textAlign: 'right', background: theme.dark }}>Pendapatan</th>
                    <th style={{ width: '15%', textAlign: 'right', background: theme.dark }}>Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {data.soldProducts.map((p, i) => (
                    <tr key={`${p.date}_${p.name}`}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{i + 1}</td>
                      <td style={{ color: '#475569' }}>
                        {p.date ? (() => {
                          const [y, m, d] = p.date.split('-').map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                        })() : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                      <td style={{ textAlign: 'right' }}>{p.qty} unit</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: p.stock <= 5 ? '#dc2626' : '#475569' }}>{p.stock} pcs</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>Rp {rp(p.revenue)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: p.profit >= 0 ? '#059669' : '#dc2626' }}>
                        Rp {rp(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, paddingRight: '8px' }}>TOTAL PENJUALAN</td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>Rp {rp(data.soldProducts.reduce((s, p) => s + p.revenue, 0))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669' }}>Rp {rp(data.soldProducts.reduce((s, p) => s + p.profit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p style={{ fontSize: '8pt', color: '#94a3b8', padding: '4mm 0' }}>Belum ada data penjualan.</p>
            )}
          </div>

          {/* ── EXPENSES LIST TABLE ── */}
          {data.expensesList && data.expensesList.length > 0 && (
            <div className="wk-pr-table-section">
              <h3 className="wk-pr-section-title-lg" style={{ borderBottomColor: theme.primary }}>
                Daftar Pengeluaran Operasional
              </h3>
              <table className="wk-pr-table">
                <thead>
                  <tr>
                    <th style={{ width: '5%', background: theme.dark }}>No</th>
                    <th style={{ width: '20%', background: theme.dark }}>Tanggal</th>
                    <th style={{ width: '35%', background: theme.dark }}>Deskripsi</th>
                    <th style={{ width: '20%', background: theme.dark }}>Kategori</th>
                    <th style={{ width: '20%', textAlign: 'right', background: theme.dark }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expensesList.map((e, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{i + 1}</td>
                      <td style={{ color: '#475569' }}>
                        {(() => {
                          const [y, m, d] = e.date.split('-').map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                        })()}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        {e.title}
                        {e.notes ? <div style={{ fontSize: '6pt', color: '#94a3b8', marginTop: '0.5mm', fontWeight: 'normal' }}>Catatan: {e.notes}</div> : null}
                      </td>
                      <td style={{ fontWeight: 600, color: '#475569' }}>{e.categoryName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>Rp {rp(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, paddingRight: '8px' }}>TOTAL PENGELUARAN</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#e11d48' }}>Rp {rp(data.expensesList.reduce((s, e) => s + e.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div className="wk-pr-footer" style={{ borderTopColor: theme.light }}>
            <span>Dibuat oleh sistem <strong>MesenAe</strong> — Aplikasi Kasir UMKM</span>
            <span>Dicetak: {new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</span>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 8mm; }

          html, body {
            width: 100% !important; height: auto !important;
            margin: 0 !important; padding: 0 !important;
            background: white !important; position: static !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body > :not(#mesenae-print-section) { display: none !important; }

          #mesenae-print-section {
            display: block !important; position: static !important;
            width: 100% !important; visibility: visible !important; opacity: 1 !important;
          }

          .wk-pr-wrapper { display: block !important; position: static !important; width: 100% !important; }

          .wk-pr-container {
            width: 100% !important; max-width: 100% !important;
            box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            background: white !important; color: #000 !important;
          }

          * { box-sizing: border-box !important; }

          .wk-pr-header, .wk-pr-summary-grid, .wk-pr-net-box,
          .wk-pr-charts-row, .wk-pr-footer {
            page-break-inside: avoid !important; break-inside: avoid !important;
          }
          thead { display: table-header-group !important; }
          tfoot { display: table-row-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }

          /* HEADER */
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

          /* SUMMARY GRID */
          .wk-pr-summary-grid {
            display: grid !important; grid-template-columns: repeat(4, 1fr) !important;
            gap: 2mm !important; margin-bottom: 2.5mm !important;
          }
          .wk-pr-summary-card {
            padding: 2mm 2.5mm !important; border-radius: 1.5mm !important;
            border: 1px solid #e2e8f0 !important; border-left-width: 2.5mm !important;
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .wk-pr-summary-label { font-size: 5.5pt !important; text-transform: uppercase !important; font-weight: 800 !important; margin: 0 0 1mm !important; color: #64748b !important; line-height: 1.2 !important; }
          .wk-pr-summary-value { font-size: 8pt !important; font-weight: 900 !important; margin: 0 !important; color: #0f172a !important; }

          /* NET PROFIT BOX */
          .wk-pr-net-box {
            display: flex !important; justify-content: space-between !important;
            align-items: center !important; padding: 2.5mm 3.5mm !important;
            border-radius: 1.5mm !important; margin-bottom: 2.5mm !important;
            border: 2px solid !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .wk-pr-net-title { font-size: 8pt !important; font-weight: 800 !important; margin: 0 0 0.5mm !important; color: #0f172a !important; }
          .wk-pr-net-sub   { font-size: 6pt !important; color: #64748b !important; margin: 0 !important; }
          .wk-pr-net-value { font-size: 13pt !important; font-weight: 900 !important; white-space: nowrap !important; }

          /* CHARTS ROW */
          .wk-pr-charts-row {
            display: flex !important; gap: 3mm !important;
            margin-bottom: 8mm !important; align-items: flex-start !important;
          }
          .wk-pr-chart-left { flex: 1.4 !important; min-width: 0 !important; }
          .wk-pr-chart-right { flex: 1 !important; min-width: 0 !important; }
          .wk-pr-section-title {
            font-size: 7.5pt !important; font-weight: 800 !important;
            margin: 0 0 1.5mm !important; text-transform: uppercase !important;
            letter-spacing: 0.2mm !important;
          }
          .wk-pr-chart-wrap { width: 100% !important; height: 42mm !important; overflow: visible !important; }
          .wk-pr-pie-wrap   { width: 100% !important; height: 42mm !important; overflow: visible !important; }

          /* TABLE */
          .wk-pr-table-section { margin-bottom: 3mm !important; }
          .wk-pr-section-title-lg {
            font-size: 9pt !important; font-weight: 800 !important; color: #0f172a !important;
            margin: 0 0 2mm !important; text-transform: uppercase !important;
            border-bottom: 1.5pt solid !important; padding-bottom: 1mm !important;
          }
          .wk-pr-table { width: 100% !important; border-collapse: collapse !important; font-size: 7.5pt !important; }
          .wk-pr-table th {
            color: white !important; padding: 1.5mm 2mm !important;
            font-weight: 700 !important; font-size: 6.5pt !important;
            text-transform: uppercase !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .wk-pr-table td { padding: 1.5mm 2mm !important; border-bottom: 0.5pt solid #e2e8f0 !important; color: #334155 !important; }
          .wk-pr-table tbody tr:nth-child(even) td {
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .wk-pr-table tfoot td {
            background: #f1f5f9 !important; border-top: 1.5pt solid #334155 !important;
            font-size: 8pt !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }

          /* FOOTER */
          .wk-pr-footer {
            display: flex !important; justify-content: space-between !important;
            align-items: center !important; margin-top: 4mm !important;
            padding-top: 2mm !important; border-top: 0.5pt solid !important;
            font-size: 6pt !important; color: #94a3b8 !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
