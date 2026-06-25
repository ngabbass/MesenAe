
interface MidtransChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_status?: string;
  error_messages?: string[];
  [key: string]: unknown;
}

export default async function handler(req: any, res: any) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. Validasi Method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  // 2. Ambil & Validasi Environment Variables
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
  const serverKey = process.env.MIDTRANS_SERVER_KEY || process.env.VITE_MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    console.error('[Midtrans Charge] Server Key is missing.');
    return res.status(500).json({
      error_messages: ['Server misconfiguration: Midtrans Server Key tidak ditemukan.'],
    });
  }

  const authString = Buffer.from(`${serverKey}:`).toString('base64');
  const baseUrl = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';

  try {
    // 3. Tembak API Midtrans
    const response = await fetch(`${baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      // Amankan pembacaan body
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    });

    // 4. Parsing Respons dengan Aman
    const text = await response.text();
    let data: MidtransChargeResponse;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({
        error_messages: ['Respons tidak valid dari Gateway Pembayaran (Bukan JSON).'],
        raw_text: text,
      });
    }

    console.info(`[Midtrans Charge] HTTP: ${response.status} | Status Code: ${data.status_code}`);

    // 5. Evaluasi Sukses (Midtrans menggunakan '200', '201', '202')
    const isSuccess = ['200', '201', '202'].includes(String(data.status_code));

    if (!isSuccess) {
      const errMsg = data.error_messages?.[0] || data.status_message || `Gagal memproses (Status: ${data.status_code})`;
      return res.status(422).json({ error_messages: [errMsg], raw: data });
    }

    return res.status(200).json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Midtrans Charge] Critical Error:', errMsg);
    return res.status(500).json({
      error_messages: [`Gagal terhubung ke server pembayaran: ${errMsg}`],
    });
  }
}
