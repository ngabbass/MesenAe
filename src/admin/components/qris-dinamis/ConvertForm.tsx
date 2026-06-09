import { useState } from "react";
import type { QRISData, ConvertOptions } from "../../../lib/qris-dinamis/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, ShieldCheck } from "lucide-react";

interface Props {
  parsed: QRISData;
  onConvert: (options: ConvertOptions) => void;
  disabled?: boolean;
}

type FeeType = "none" | "fixed" | "percentage";

export function ConvertForm({ parsed, onConvert, disabled }: Props) {
  const [amount, setAmount] = useState("");
  const [feeType, setFeeType] = useState<FeeType>("none");
  const [feeValue, setFeeValue] = useState("");

  if (parsed.method === "dynamic") {
    return (
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-4">
        <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4" />
          QRIS ini sudah Dinamis dengan nominal Rp {Number(parsed.amount ?? 0).toLocaleString("id-ID")}
        </p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const options: ConvertOptions = { amount: amountNum };

    if (feeType !== "none" && feeValue) {
      const feeNum = parseFloat(feeValue);
      if (!isNaN(feeNum) && feeNum > 0) {
        options.fee = { type: feeType, value: feeNum };
      }
    }

    onConvert(options);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Banknote className="w-4 h-4 text-primary" />
          Konversi ke QRIS Dinamis
        </h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Amount */}
        <div className="space-y-2">
          <Label>Nominal (Rupiah)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Rp
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              required
              disabled={disabled}
              className="pl-9"
            />
          </div>
        </div>

        {/* Service Fee */}
        <div className="space-y-2">
          <Label>Biaya Layanan (Opsional)</Label>
          <div className="flex gap-2">
            {(["none", "fixed", "percentage"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={feeType === type ? "default" : "outline"}
                disabled={disabled}
                onClick={() => {
                  setFeeType(type);
                  setFeeValue("");
                }}
                className="flex-1"
              >
                {type === "none" ? "Tanpa Biaya" : type === "fixed" ? "Nominal (Rp)" : "Persen (%)"}
              </Button>
            ))}
          </div>
        </div>

        {feeType !== "none" && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {feeType === "fixed" ? "Rp" : "%"}
              </span>
              <Input
                type="number"
                value={feeValue}
                onChange={(e) => setFeeValue(e.target.value)}
                placeholder="0"
                min="0"
                step={feeType === "percentage" ? "0.1" : "1"}
                disabled={disabled}
                className="pl-9"
              />
            </div>
          </div>
        )}

        <Button type="submit" disabled={disabled} className="w-full">
          Buat QRIS Dinamis
        </Button>
      </div>
    </form>
  );
}
