import { calculateCRC16 } from "./crc16";
import { parseTLV } from "./parser";
import type { ValidationResult } from "./types";

/**
 * Validasi struktur QRIS string.
 */
export function validateQRIS(qrisString: string): ValidationResult {
  const errors: string[] = [];

  if (!qrisString || qrisString.trim().length === 0) {
    return { valid: false, errors: ["String QRIS tidak boleh kosong"] };
  }

  const str = qrisString.trim();

  // Harus diawali dengan Payload Format Indicator "000201"
  if (!str.startsWith("000201")) {
    errors.push(
      'QRIS harus diawali dengan Payload Format Indicator "000201"'
    );
  }

  // Panjang minimum (header + CRC = minimal 20 karakter)
  if (str.length < 20) {
    errors.push("String QRIS terlalu pendek");
    return { valid: false, errors };
  }

  // Validasi CRC
  const dataWithoutCRC = str.substring(0, str.length - 4);
  const declaredCRC = str.substring(str.length - 4);
  const calculatedCRC = calculateCRC16(dataWithoutCRC);

  if (declaredCRC.toUpperCase() !== calculatedCRC) {
    errors.push(
      `CRC tidak sesuai: diharapkan ${calculatedCRC}, ditemukan ${declaredCRC.toUpperCase()}`
    );
  }

  // Coba parsing struktur TLV
  const elements = parseTLV(str);

  if (elements.length === 0) {
    errors.push("Gagal membaca elemen TLV dari string QRIS");
    return { valid: false, errors };
  }

  // Periksa tag yang wajib ada
  const tags = new Set(elements.map((e) => e.tag));

  const requiredTags = [
    { tag: "00", name: "Payload Format Indicator" },
    { tag: "01", name: "Point of Initiation Method" },
    { tag: "52", name: "Merchant Category Code" },
    { tag: "53", name: "Transaction Currency" },
    { tag: "58", name: "Country Code" },
    { tag: "59", name: "Merchant Name" },
    { tag: "60", name: "Merchant City" },
    { tag: "63", name: "CRC" },
  ];

  for (const req of requiredTags) {
    if (!tags.has(req.tag)) {
      errors.push(`Tag wajib tidak ditemukan: ${req.tag} (${req.name})`);
    }
  }

  // Periksa nilai Point of Initiation Method
  const method = elements.find((e) => e.tag === "01");
  if (method && method.value !== "11" && method.value !== "12") {
    errors.push(
      `Nilai Point of Initiation Method tidak valid: "${method.value}" (harus "11" atau "12")`
    );
  }

  // Periksa minimal satu Merchant Account Info (tag 26-51)
  const hasMerchant = elements.some((e) => {
    const n = parseInt(e.tag, 10);
    return n >= 26 && n <= 51;
  });
  if (!hasMerchant) {
    errors.push("Tidak ditemukan informasi merchant (tag 26-51)");
  }

  return { valid: errors.length === 0, errors };
}
