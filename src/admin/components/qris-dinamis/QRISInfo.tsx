import type { QRISData } from "../../../lib/qris-dinamis/types";
import { Info } from "lucide-react";

interface Props {
  data: QRISData;
}

const CURRENCY_MAP: Record<string, string> = {
  "360": "IDR (Rupiah)",
  "840": "USD (Dollar)",
};

const MCC_MAP: Record<string, string> = {
  "4111": "Transportation",
  "4121": "Taxi",
  "4814": "Telecommunication",
  "5311": "Department Store",
  "5411": "Grocery Store",
  "5499": "Food Store",
  "5812": "Restaurant / Eating Places",
  "5814": "Fast Food",
  "5912": "Pharmacy",
  "5999": "Retail Store",
  "7299": "Other Services",
  "8011": "Medical",
  "8999": "Professional Services",
};

export function QRISInfo({ data }: Props) {
  const merchantInfo = data.merchantAccountInfo[0];
  const issuer = merchantInfo?.globallyUniqueId ?? "-";

  return (
    <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          Informasi QRIS
        </h2>
      </div>
      <div className="divide-y divide-border/50">
        <InfoRow label="Merchant" value={data.merchantName} />
        <InfoRow label="Kota" value={data.merchantCity} />
        <InfoRow label="Kode Pos" value={data.postalCode} />
        <InfoRow label="Issuer" value={issuer} />
        <InfoRow
          label="Tipe"
          value={
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                data.method === "static"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              }`}
            >
              {data.method === "static" ? "Statis" : "Dinamis"}
            </span>
          }
        />
        <InfoRow
          label="Kategori"
          value={MCC_MAP[data.merchantCategoryCode] ?? data.merchantCategoryCode}
        />
        <InfoRow
          label="Mata Uang"
          value={CURRENCY_MAP[data.currency] ?? data.currency}
        />
        {data.amount && <InfoRow label="Nominal" value={`Rp ${Number(data.amount).toLocaleString("id-ID")}`} />}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right truncate">{value}</span>
    </div>
  );
}
